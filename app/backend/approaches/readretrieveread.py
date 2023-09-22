import openai
from approaches.approach import Approach
from azure.search.documents import SearchClient
from azure.search.documents.models import QueryType
from langchain.llms.openai import AzureOpenAI
from langchain.callbacks.manager import CallbackManager, Callbacks
from langchain.chains import LLMChain
from langchain.agents import Tool, ZeroShotAgent, AgentExecutor
from langchainadapters import HtmlCallbackHandler
from text import nonewlines
from lookuptool import CsvLookupTool
from typing import Any


class ReadRetrieveReadApproach(Approach):
    """
    Attempt to answer questions by iteratively evaluating the question to see what information is missing, and once all information
    is present then formulate an answer. Each iteration consists of two parts:
     1. use GPT to see if we need more information
     2. if more data is needed, use the requested "tool" to retrieve it.
    The last call to GPT answers the actual question.
    This is inspired by the MKRL paper[1] and applied here using the implementation in Langchain.

    [1] E. Karpas, et al. arXiv:2205.00445
    """

    template_prefix = \
        "You are an intelligent assistant helping users with questions regarding DIN Standards, ISO Standards, and general standard definitions. " \
        "Answer the question using only the data provided in the information sources below. " \
        "For tabular information return it as an html table. Do not return markdown format. " \
        "Each source has a name followed by colon and the actual data, quote the source name for each piece of data you use in the response. " \
        "For example, if the question is \"What is the DIN standard for XYZ?\" and one of the information sources says \"info123: DIN standard for XYZ is ...\", then answer with \"DIN standard for XYZ is ... [info123]\" " \
        "It's important to strictly follow the format where the name of the source is in square brackets at the end of the sentence, and only up to the prefix before the colon (\":\"). " \
        "If there are multiple sources, cite each one in their own square brackets. For example, use \"[info343][ref-76]\" and not \"[info343,ref-76]\". " \
        "Never quote tool names as sources." \
        "If you cannot answer using the sources below, say that you don't know. " \
        "\n\nYou can access to the following tools:"

    template_suffix = """
Begin!

Question: {input}

Thought: {agent_scratchpad}"""

    CognitiveSearchToolDescription = "useful for searching for details about DIN and ISO standards."

    def __init__(self, search_client: SearchClient, openai_deployment: str, sourcepage_field: str, content_field: str):
        self.search_client = search_client
        self.openai_deployment = openai_deployment
        self.sourcepage_field = sourcepage_field
        self.content_field = content_field

    def retrieve(self, q: str, overrides: dict[str, Any]) -> Any:
        use_semantic_captions = True if overrides.get(
            "semantic_captions") else False
        top = overrides.get("top") or 3
        exclude_category = overrides.get("exclude_category") or None
        filter = "category ne '{}'".format(
            exclude_category.replace("'", "''")) if exclude_category else None

        if overrides.get("semantic_ranker"):
            r = self.search_client.search(q,
                                          filter=filter,
                                          query_type=QueryType.SEMANTIC,
                                          query_language="en-us",
                                          query_speller="lexicon",
                                          semantic_configuration_name="default",
                                          top=top,
                                          query_caption="extractive|highlight-false" if use_semantic_captions else None)
        else:
            r = self.search_client.search(q, filter=filter, top=top)
        if use_semantic_captions:
            self.results = [doc[self.sourcepage_field] + ":" + nonewlines(
                " -.- ".join([c.text for c in doc['@search.captions']])) for doc in r]
        else:
            self.results = [doc[self.sourcepage_field] + ":" +
                            nonewlines(doc[self.content_field][:250]) for doc in r]
        content = "\n".join(self.results)
        return content

    def run(self, q: str, overrides: dict[str, Any]) -> Any:
        self.results = None

        cb_handler = HtmlCallbackHandler()
        cb_manager = CallbackManager(handlers=[cb_handler])

        acs_tool = Tool(name="CognitiveSearch",
                        func=lambda q: self.retrieve(q, overrides),
                        description=self.CognitiveSearchToolDescription,
                        callbacks=cb_manager)
        standard_tool = StandardInfoTool("Standard1", callbacks=cb_manager)
        tools = [acs_tool, standard_tool]

        prompt = ZeroShotAgent.create_prompt(
            tools=tools,
            prefix=overrides.get("prompt_template_prefix",
                                 self.template_prefix),
            suffix=overrides.get("prompt_template_suffix",
                                 self.template_suffix),
            input_variables=["input", "agent_scratchpad"])

        llm = AzureOpenAI(deployment_name=self.openai_deployment, temperature=overrides.get(
            "temperature", 0.6), openai_api_key=openai.api_key)
        chain = LLMChain(llm=llm, prompt=prompt)
        agent_exec = AgentExecutor.from_agent_and_tools(
            agent=ZeroShotAgent(llm_chain=chain, tools=tools),
            tools=tools,
            verbose=True,
            callback_manager=cb_manager)
        result = agent_exec.run(q)

        result = result.replace("[CognitiveSearch]",
                                "").replace("[Standard]", "")

        return {"data_points": self.results or [], "answer": result, "thoughts": cb_handler.get_and_reset_log()}


class StandardInfoTool(CsvLookupTool):
    standard_name: str = ""

    def __init__(self, standard_name: str, callbacks: Callbacks = None):
        super().__init__(filename="data/standards.csv",
                         key_field="humanname",
                         name="Standard",
                         description="useful for answering questions about various DIN and ISO standards, their definitions, and details",
                         callbacks=callbacks)
        self.func = self.standard_info
        self.standard_name = standard_name

    def standard_info(self, name: str) -> str:
        result = self.lookup(name)
        if result:
            definition = result.get("definition", "Not defined")
            unit = result.get("unit", "")
            value = result.get("value", "")

            response = f"Definition: {definition}"
            if unit:
                response += f"\nUnit: {unit}"
            if value:
                response += f"\nValue: {value}"

            return response
        else:
            return "Information not found in the dataset."
