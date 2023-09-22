from collections import Counter
import re
from typing import Any, Sequence

import openai
import tiktoken
from azure.search.documents import SearchClient
from azure.search.documents.models import QueryType
from approaches.approach import Approach
from text import nonewlines

from neo4j import GraphDatabase


def get_neo4j_session(uri, user, password):
    driver = GraphDatabase.driver(uri, auth=(user, password))
    return driver


def test_connection(driver):
    try:
        with driver.session() as session:
            session.run("RETURN 1")
        print("Connected successfully to Neo4j")
    except Exception as e:
        print("Error connecting to Neo4j:", e)


def execute_cypher_query(query):
    try:
        with driver.session() as session:
            result = session.run(query)
            records = []

            for record in result:
                data = {}
                for field in record.keys():
                    data[field] = dict(record[field])
                records.append(data)

            if not records:
                return '0'

            return records
    except Exception as e:
        print(f"Error executing Cypher query: {e}")
        return []


def extract_keywords(input_text):
    field_patterns = [
        r"(?i)Mechanical",
        r"(?i)Electrical",
        r"(?i)Computer"
    ]

    model_patterns = [
        r"(?i)Gehäuse",
        r"(?i)Griff",
        r"(?i)Rad",
        r"(?i)Rahmen",
        r"(?i)Rolle",
        r"(?i)Rollenhalter"
    ]

    patternDIN = r"(?i)DIN\s*(?:ISO)*\s*:?\s*[A-Z]*\d+|DIN\s*:?\s*[A-Z]*\d+"
    matchesDIN = re.findall(patternDIN, input_text)

    patternEquation = r"(?i)equation"
    matchesEquation = re.findall(patternEquation, input_text)

    def extract_most_frequent(patterns):
        found_keywords = []
        for pattern in patterns:
            matches = re.findall(pattern, input_text)
            found_keywords.extend(matches)

        keyword_counts = Counter(found_keywords)
        max_count = keyword_counts.most_common(1)[0][1]

        return [kw for kw, count in keyword_counts.items() if count == max_count]

    most_frequent_fields = extract_most_frequent(field_patterns)
    most_frequent_models = extract_most_frequent(model_patterns)
    matchesEquation = extract_most_frequent(matchesEquation)

    combined_matches = most_frequent_fields + \
        most_frequent_models + matchesDIN + matchesEquation
    print(combined_matches)
    return combined_matches


def generate_query_from_keywords(keywords):
    queries = []

    for field in ["Mechanical", "Electrical", "Computer"]:
        if field in keywords:
            queries.append(
                f"MATCH (model:Model)-[:IS_OF_FIELD]->(field:Field {{name: '{field}'}}), (model)-[:FOLLOWS_STANDARD]->(din:DIN) RETURN model, din")

    for model in ["Gehäuse", "Griff", "Rad", "Rahmen", "Rolle"]:
        if model in keywords:
            queries.append(
                f"MATCH ({model.lower()}:Model {{name: '{model}'}})-[:FOLLOWS_STANDARD]->(din:DIN) RETURN {model.lower()}, din")

    din_found = False
    for keyword in keywords:
        if "DIN" in keyword:
            din_found = True
            queries.append(
                f"MATCH (din:DIN {{number: '{keyword}'}})-[:HAS_EQUATION]->(equation:Equation) RETURN din, equation")

    if "equation" in keywords and not din_found:
        queries.append(
            "MATCH (din:DIN)-[:HAS_EQUATION]->(equation:Equation) RETURN din, equation")

    return queries


def format_response_to_nlp(response):
    nlp_responses = []

    for entry in response:
        segments = []

        def process_din(din):
            details = [
                f"The {din['number']} is a standard" if din.get(
                    'number') else None,
                f"for {din['summary'].lower()}" if din.get(
                    'summary') else None,
                f"issued on {din['date_issued']}" if din.get(
                    'date_issued') else None,
                f"and is currently {din['status']}" if din.get(
                    'status') else None,
                f"Further explanation: {din['explanation']}" if din.get(
                    'explanation') else None
            ]
            return " ".join(filter(None, details))

        def process_equation(equation):
            details = [
                f"It is associated with the equation {equation['formula']}" if equation.get(
                    'formula') else None,
                f", which describes {equation['description'].lower()}" if equation.get(
                    'description') else None,
                f"Mathematical explanation: {equation['explanation_math']}" if equation.get(
                    'explanation_math') else None
            ]
            return " ".join(filter(None, details))

        if 'din' in entry:
            segments.append(process_din(entry['din']))
        if 'equation' in entry:
            segments.append(process_equation(entry['equation']))

        nlp_description = ". ".join(filter(None, segments)).strip()
        if nlp_description:
            nlp_responses.append(nlp_description)

    return nlp_responses


def process_user_input(input_text):
    keyword = extract_keywords(input_text)
    generatequery = generate_query_from_keywords(keyword)
    all_results = []
    for query in generatequery:
        response = execute_cypher_query(query)
        all_results.extend(response)

    response = format_response_to_nlp(response)

    return response


uri = "bolt://localhost:7687"
user = "neo4j"
password = "123456789"
driver = get_neo4j_session(uri, user, password)
test_connection(driver)


class ChatReadRetrieveReadApproach(Approach):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"

    """
    Simple retrieve-then-read implementation, using the Cognitive Search and OpenAI APIs directly. It first retrieves
    top documents from search, then constructs a prompt with them, and then uses OpenAI to generate an completion
    (answer) with that prompt.
    """
    system_message_chat_conversation = """Assistant helps the company employees with their healthcare plan questions, and questions about the employee handbook. Be brief in your answers.
Answer ONLY with the facts listed in the list of sources below. If there isn't enough information below, say you don't know. Do not generate answers that don't use the sources below. If asking a clarifying question to the user would help, ask the question.
For tabular information return it as an html table. Do not return markdown format.
Each source has a name followed by colon and the actual information, always include the source name for each fact you use in the response. Use square brackets to reference the source, e.g. [info1.txt]. Don't combine sources, list each source separately, e.g. [info1.txt][info2.pdf].
{follow_up_questions_prompt}
{injected_prompt}
"""
    follow_up_questions_prompt_content = """Generate three very brief follow-up questions that the user would likely ask next about their healthcare plan and employee handbook. 
    Use double angle brackets to reference the questions, e.g. <<Are there exclusions for prescriptions?>>.
    Try not to repeat questions that have already been asked.
    Only generate questions and do not generate any text before or after the questions, such as 'Next Questions'"""

    query_prompt_template = """Below is a history of the conversation so far, and a new question asked by the user that needs to be answered by searching in a knowledge base about employee healthcare plans and the employee handbook.
    Generate a search query based on the conversation and the new question. 
    Do not include cited source filenames and document names e.g info.txt or doc.pdf in the search query terms.
    Do not include any text inside [] or <<>> in the search query terms.
    If the question is not in English, translate the question to English before generating the search query.

Chat History:
{chat_history}

Question:
{question}

Search query:
"""

    def __init__(self, search_client: SearchClient, chatgpt_deployment: str, chatgpt_model: str, gpt_deployment: str, sourcepage_field: str, content_field: str):
        self.search_client = search_client
        self.chatgpt_deployment = chatgpt_deployment
        self.chatgpt_model = chatgpt_model
        self.gpt_deployment = gpt_deployment
        self.sourcepage_field = sourcepage_field
        self.content_field = content_field

    def run(self, history: Sequence[dict[str, str]], overrides: dict[str, Any]) -> Any:
        q = "hi"
        try:
            use_semantic_captions = True if overrides.get(
                "semantic_captions") else False
            top = overrides.get("top") or 3
            exclude_category = overrides.get("exclude_category") or None
            filter = "category ne '{}'".format(
                exclude_category.replace("'", "''")) if exclude_category else None

            # STEP 1: Generate an optimized keyword search query based on the chat history and the last question
            prompt = self.query_prompt_template.format(chat_history=self.get_chat_history_as_text(
                history, include_last_turn=False), question=history[-1]["user"])
            completion = openai.Completion.create(
                engine=self.gpt_deployment,
                prompt=prompt,
                temperature=0.0,
                max_tokens=32,
                n=1,
                stop=["\n"])
            q = completion.choices[0].text
            # STEP 2: Retrieve relevant documents from the search index with the GPT optimized query
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
                results = [doc[self.sourcepage_field] + ": " + nonewlines(
                    " . ".join([c.text for c in doc['@search.captions']])) for doc in r]
            else:
                results = [doc[self.sourcepage_field] + ": " +
                           nonewlines(doc[self.content_field]) for doc in r]
            content = "\n".join(results)

            follow_up_questions_prompt = self.follow_up_questions_prompt_content if overrides.get(
                "suggest_followup_questions") else ""

            # Allow client to replace the entire prompt, or to inject into the exiting prompt using >>>
            prompt_override = overrides.get("prompt_template")
            messages = self.get_messages_from_history(
                prompt_override=prompt_override, follow_up_questions_prompt=follow_up_questions_prompt, history=history, sources=content)

            # STEP 3: Generate a contextual and content specific answer using the search results and chat history
            chat_completion = openai.ChatCompletion.create(
                deployment_id=self.chatgpt_deployment,
                model=self.chatgpt_model,
                messages=messages,
                temperature=overrides.get("temperature") or 0.7,
                max_tokens=1024,
                n=1)

            chat_content = chat_completion.choices[0].message.content

            msg_to_display = '\n\n'.join(
                [str(message) for message in messages])

            return {"data_points": results, "answer": chat_content, "thoughts": f"Searched for:<br>{q}<br><br>Conversations:<br>" + msg_to_display.replace('\n', '<br>')}

        except Exception as e:
            print("An error occurred:", e)
            user_question = history[-1]["user"]
            print(user_question)
            neo4j_response = process_user_input(
                user_question)
            if neo4j_response == '0':
                chat_content = "Sorry, no information was found. Please ensure that you entered the DIN correctly and mention the name of the model you worked on, as well as the field in which you are working."
            else:
                chat_content = "Data Retrieved from Neo4j:\n" + \
                    '\n'.join(neo4j_response)

                print(chat_content)

            msg_to_display = "Some conversation history..."

        return {
            "data_points": neo4j_response,
            "answer": chat_content,
            "thoughts": f"Searched for:<br>{q}<br><br>Conversations:<br>" + msg_to_display.replace('\n', '<br>')
        }

    def get_chat_history_as_text(self, history: Sequence[dict[str, str]], include_last_turn: bool = True, approx_max_tokens: int = 1000) -> str:
        history_text = ""
        for h in reversed(history if include_last_turn else history[:-1]):
            history_text = """<|im_start|>user""" + "\n" + h["user"] + "\n" + """<|im_end|>""" + "\n" + """<|im_start|>assistant""" + "\n" + (
                h.get("bot", "") + """<|im_end|>""" if h.get("bot") else "") + "\n" + history_text
            if len(history_text) > approx_max_tokens*4:
                break
        return history_text

    def get_messages_from_history(self, prompt_override, follow_up_questions_prompt, history: Sequence[dict[str, str]], sources: str, approx_max_tokens: int = 1000) -> []:
        '''
        Generate messages needed for chat Completion api
        '''
        messages = []
        token_count = 0
        if prompt_override is None:
            system_message = self.system_message_chat_conversation.format(
                injected_prompt="", follow_up_questions_prompt=follow_up_questions_prompt)
        elif prompt_override.startswith(">>>"):
            system_message = self.system_message_chat_conversation.format(
                injected_prompt=prompt_override[3:] + "\n", follow_up_questions_prompt=follow_up_questions_prompt)
        else:
            system_message = prompt_override.format(
                follow_up_questions_prompt=follow_up_questions_prompt)

        messages.append({"role": self.SYSTEM, "content": system_message})
        token_count += self.num_tokens_from_messages(
            messages[-1], self.chatgpt_model)

        user_content = history[-1]["user"] + " \nSources:" + sources
        messages.append({"role": self.USER, "content": user_content})
        token_count += token_count + \
            self.num_tokens_from_messages(messages[-1], self.chatgpt_model)

        '''
        Enqueue in reverse order
        if limit exceeds truncate old messages 
        leaving system message behind
        Keep track of token count for each conversation
        If token count exceeds limit, break
        '''
        for h in reversed(history[:-1]):
            if h.get("bot"):
                messages.insert(
                    1, {"role": self.ASSISTANT, "content": h.get("bot")})
                token_count += self.num_tokens_from_messages(
                    messages[1], self.chatgpt_model)
            messages.insert(1, {"role": self.USER, "content": h.get("user")})
            token_count += self.num_tokens_from_messages(
                messages[1], self.chatgpt_model)
            if token_count > approx_max_tokens*4:
                break
        return messages

    def num_tokens_from_messages(self, message: dict[str, str], model: str) -> int:
        """
        Calculate the number of tokens required to encode a message.
        Args:
            message (dict): The message to encode, represented as a dictionary.
            model (str): The name of the model to use for encoding.
        Returns:
            int: The total number of tokens required to encode the message.
        Example:
            message = {'role': 'user', 'content': 'Hello, how are you?'}
            model = 'gpt-3.5-turbo'
            num_tokens_from_messages(message, model)
            output: 11
        """
        encoding = tiktoken.encoding_for_model(
            self.get_oai_chatmodel_tiktok(model))
        num_tokens = 0
        num_tokens += 2
        for key, value in message.items():
            num_tokens += len(encoding.encode(value))
        return num_tokens

    def get_oai_chatmodel_tiktok(self, aoaimodel: str):
        if aoaimodel == "" or aoaimodel is None:
            raise Exception("Expected AOAI chatGPT model name")

        return "gpt-3.5-turbo" if aoaimodel == "gpt-35-turbo" else aoaimodel
