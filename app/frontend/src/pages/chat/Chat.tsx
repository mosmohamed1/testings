import { useRef, useState, useEffect } from "react";
import { Checkbox, Panel, DefaultButton, TextField, SpinButton } from "@fluentui/react";
import { ChatFilled } from "@fluentui/react-icons";

import styles from "./Chat.module.css";

import { chatApi, Approaches, AskResponse, ChatRequest, ChatTurn } from "../../api";
import { Answer, AnswerError, AnswerLoading } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { ExampleList } from "../../components/Example";
import { UserChatMessage } from "../../components/UserChatMessage";
import { AnalysisPanel, AnalysisPanelTabs } from "../../components/AnalysisPanel";
import { ClearChatButton } from "../../components/ClearChatButton";
import httpClient from "../../api/httpClient";
import { User } from "../dashboard/types";

const LOCAL_STORAGE_KEY = "chat_data";

const Chat = () => {
    const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false);
    const [promptTemplate, setPromptTemplate] = useState<string>("");
    const [retrieveCount, setRetrieveCount] = useState<number>(3);
    const [useSemanticRanker, setUseSemanticRanker] = useState<boolean>(true);
    const [useSemanticCaptions, setUseSemanticCaptions] = useState<boolean>(false);
    const [excludeCategory, setExcludeCategory] = useState<string>("");
    const [useSuggestFollowupQuestions, setUseSuggestFollowupQuestions] = useState<boolean>(false);
    const [firstVisit, setFirstVisit] = useState(true);

    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();

    const [activeCitation, setActiveCitation] = useState<string>();
    const [activeAnalysisPanelTab, setActiveAnalysisPanelTab] = useState<AnalysisPanelTabs | undefined>(undefined);

    const [selectedAnswer, setSelectedAnswer] = useState<number>(0);
    const [answers, setAnswers] = useState<[user: string, response: AskResponse][]>([]);

    const [selectedModel, setSelectedModel] = useState<string | null>(null);
    const [modelInfo, setModelInfo] = useState<{
        model_name: string;
        image_name: string;
        focus_keywords: string[];
        pdf_file_names: string[];
    } | null>(null);

    useEffect(() => {
        const storedModel = window.sessionStorage.getItem("selectedModel") || null;
        if (storedModel) {
            const modelName = storedModel.split("/").pop() as string;
            setSelectedModel(modelName);
            console.log("Selected Model from session storage:", modelName);

            fetchModelInfo(modelName);
        } else {
            console.log("No model found in session storage.");
        }
    }, []);
    const removeExtensions = str => {
        return str.replace(/\.(stl|png|jpeg)$/i, "");
    };

    const fetchModelInfo = async (modelName: string) => {
        try {
            const response = await httpClient.get(`http://127.0.0.1:5000/get_specific_model_info/${modelName}`);

            if (response.data.image_name) {
                response.data.image_name = removeExtensions(response.data.image_name);
            }
            if (response.data.model_name) {
                response.data.model_name = removeExtensions(response.data.model_name);
            }
            if (response.data.pdf_file_names && Array.isArray(response.data.pdf_file_names)) {
                response.data.pdf_file_names = response.data.pdf_file_names.map(filename => removeExtensions(filename));
            }

            console.log("Processed Model Info:", response.data);

            setModelInfo(response.data);
        } catch (error) {
            console.error("Error fetching model info:", error);
        }
    };

    const makeApiRequest = async (question: string) => {
        lastQuestionRef.current = question;
        const fullQuestion =
            user && user.title
                ? `I'm using model called ${modelInfo?.model_name}. I'm writing to you as ${
                      user.title
                  }. I'm referring to image ${modelInfo?.image_name} and I focus on ${modelInfo?.focus_keywords?.join(
                      ", "
                  )}. I'm using the PDFs: ${modelInfo?.pdf_file_names?.join(", ")}. ${question}`
                : question;
        console.log(fullQuestion);

        error && setError(undefined);
        setIsLoading(true);
        setActiveCitation(undefined);
        setActiveAnalysisPanelTab(undefined);
        console.log(question);

        try {
            if (question === "What is the standard of DIN?") {
                const hardcodedResponseDIN: AskResponse = {
                    answer: `DIN stands for "Deutsches Institut für Normung," the German Institute for Standardization. It's Germany's national standards organization, similar to ANSI in the U.S. DIN develops standards for products, test methods, terminology, and processes. Standards often start with "DIN," followed by a number. Some DIN standards have gained international acceptance, like the DIN A4 paper size. It also contributes to European (EN) and international (ISO) standards.`,
                    thoughts: "",
                    data_points: []
                };
                setAnswers([...answers, [question, hardcodedResponseDIN]]);
            } else if (question === "who are we?") {
                const hardcodedResponseWho: AskResponse = {
                    answer: `We represent the Institute of Product Engineering at Duisburg-Essen University. Our dedicated team is diligently working on the refinement and enhancement of AI chatbots, specifically targeting the efficient retrieval of DIN Standards.`,
                    thoughts: "",
                    data_points: []
                };
                setAnswers([...answers, [question, hardcodedResponseWho]]);
            } else if (question === "What are industry standards?") {
                const hardcodedResponseWho: AskResponse = {
                    answer: `A set of criteria within an industry relating to the standard functioning and carrying out of operations in their respective fields of production. In other words, it is the generally accepted requirements followed by the members of an industry.`,
                    thoughts: "",
                    data_points: []
                };
                setAnswers([...answers, [question, hardcodedResponseWho]]);
            } else {
                const history: ChatTurn[] = answers.map(a => ({ user: a[0], bot: a[1].answer }));
                const request: ChatRequest = {
                    history: [...history, { user: fullQuestion, bot: undefined }],
                    approach: Approaches.ReadRetrieveRead,
                    overrides: {
                        promptTemplate: promptTemplate.length === 0 ? undefined : promptTemplate,
                        excludeCategory: excludeCategory.length === 0 ? undefined : excludeCategory,
                        top: retrieveCount,
                        semanticRanker: useSemanticRanker,
                        semanticCaptions: useSemanticCaptions,
                        suggestFollowupQuestions: useSuggestFollowupQuestions
                    }
                };
                const result = await chatApi(request);
                setAnswers([...answers, [question, result]]);
            }
        } catch (e) {
            setError(e);
        } finally {
            setIsLoading(false);
        }
    };

    const clearChat = () => {
        lastQuestionRef.current = "";
        error && setError(undefined);
        setActiveCitation(undefined);
        setActiveAnalysisPanelTab(undefined);
        setAnswers([]);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        setFirstVisit(true);
    };

    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" }), [isLoading]);

    const onPromptTemplateChange = (_ev?: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        setPromptTemplate(newValue || "i'm talking to you as Web Developer i want more information about Standards");
    };

    const onRetrieveCountChange = (_ev?: React.SyntheticEvent<HTMLElement, Event>, newValue?: string) => {
        setRetrieveCount(parseInt(newValue || "3"));
    };

    const onUseSemanticRankerChange = (_ev?: React.FormEvent<HTMLElement | HTMLInputElement>, checked?: boolean) => {
        setUseSemanticRanker(!!checked);
    };

    const onUseSemanticCaptionsChange = (_ev?: React.FormEvent<HTMLElement | HTMLInputElement>, checked?: boolean) => {
        setUseSemanticCaptions(!!checked);
    };

    const onExcludeCategoryChanged = (_ev?: React.FormEvent, newValue?: string) => {
        setExcludeCategory(newValue || "");
    };

    const onUseSuggestFollowupQuestionsChange = (_ev?: React.FormEvent<HTMLElement | HTMLInputElement>, checked?: boolean) => {
        setUseSuggestFollowupQuestions(!!checked);
    };

    const onExampleClicked = (example: string) => {
        makeApiRequest(example);
    };

    const onShowCitation = (citation: string, index: number) => {
        if (activeCitation === citation && activeAnalysisPanelTab === AnalysisPanelTabs.CitationTab && selectedAnswer === index) {
            setActiveAnalysisPanelTab(undefined);
        } else {
            setActiveCitation(citation);
            setActiveAnalysisPanelTab(AnalysisPanelTabs.CitationTab);
        }

        setSelectedAnswer(index);
    };

    const onToggleTab = (tab: AnalysisPanelTabs, index: number) => {
        if (activeAnalysisPanelTab === tab && selectedAnswer === index) {
            setActiveAnalysisPanelTab(undefined);
        } else {
            setActiveAnalysisPanelTab(tab);
        }

        setSelectedAnswer(index);
    };
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const resp = await httpClient.get("http://127.0.0.1:5000/@me");
                setUser(resp.data);
            } catch (error) {
                console.log("not authenticated");
            }
        })();
    }, []);

    useEffect(() => {
        const storedChatData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (storedChatData) {
            setAnswers(JSON.parse(storedChatData));
        }
    }, []);
    useEffect(() => {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(answers));
    }, [answers]);
    useEffect(() => {
        if (localStorage.getItem("chat_visited")) {
            setFirstVisit(false);
        } else {
            setFirstVisit(true);
        }
    }, []);
    useEffect(() => {
        if (firstVisit) {
            localStorage.setItem("chat_visited", "true");
        }
    }, [firstVisit]);

    return (
        <div className={styles.container}>
            <div className={styles.commandsContainer}>
                <ClearChatButton className={styles.commandButton} onClick={clearChat} disabled={!lastQuestionRef.current || isLoading} />
            </div>
            <div className={styles.chatRoot}>
                <div className={styles.chatContainer}>
                    {answers.length === 0 && firstVisit && (
                        <div className={styles.chatEmptyState}>
                            <ChatFilled fontSize={"120px"} primaryFill={"rgba(46, 62, 132, 1)"} aria-hidden="true" aria-label="Chat logo" />
                            <h1 className={styles.chatEmptyStateTitle}>Chat with SMART Standards</h1>
                            <ExampleList onExampleClicked={onExampleClicked} />
                            <div className={styles.chatPrompt}>Hi {user?.firstName || "There"}, how can I help you?</div>{" "}
                        </div>
                    )}
                    <div className={styles.chatMessageStream}>
                        {answers.map((answer, index) => (
                            <div key={index}>
                                <UserChatMessage message={answer[0]} />
                                <div className={styles.chatMessageGpt}>
                                    <Answer
                                        key={index}
                                        answer={answer[1]}
                                        isSelected={selectedAnswer === index && activeAnalysisPanelTab !== undefined}
                                        onCitationClicked={c => onShowCitation(c, index)}
                                        onThoughtProcessClicked={() => onToggleTab(AnalysisPanelTabs.ThoughtProcessTab, index)}
                                        onSupportingContentClicked={() => onToggleTab(AnalysisPanelTabs.SupportingContentTab, index)}
                                        onFollowupQuestionClicked={q => makeApiRequest(q)}
                                        showFollowupQuestions={useSuggestFollowupQuestions && answers.length - 1 === index}
                                    />
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <>
                                <UserChatMessage message={lastQuestionRef.current} />
                                <div className={styles.chatMessageGptMinWidth}>
                                    <AnswerLoading />
                                </div>
                            </>
                        )}
                        {error ? (
                            <>
                                <UserChatMessage message={lastQuestionRef.current} />
                                <div className={styles.chatMessageGptMinWidth}>
                                    <AnswerError error={error.toString()} onRetry={() => makeApiRequest(lastQuestionRef.current)} />
                                </div>
                            </>
                        ) : null}
                        <div ref={chatMessageStreamEnd} />
                    </div>

                    <div className={styles.chatInput}>
                        <QuestionInput
                            clearOnSend
                            placeholder="Type a new question (e.g. what is the DIN Standards?)"
                            disabled={isLoading}
                            onSend={question => makeApiRequest(question)}
                        />
                    </div>
                </div>

                {answers.length > 0 && activeAnalysisPanelTab && (
                    <AnalysisPanel
                        className={styles.chatAnalysisPanel}
                        activeCitation={activeCitation}
                        onActiveTabChanged={x => onToggleTab(x, selectedAnswer)}
                        citationHeight="810px"
                        answer={answers[selectedAnswer][1]}
                        activeTab={activeAnalysisPanelTab}
                    />
                )}

                <Panel
                    headerText="Configure answer generation"
                    isOpen={isConfigPanelOpen}
                    isBlocking={false}
                    onDismiss={() => setIsConfigPanelOpen(false)}
                    closeButtonAriaLabel="Close"
                    onRenderFooterContent={() => <DefaultButton onClick={() => setIsConfigPanelOpen(false)}>Close</DefaultButton>}
                    isFooterAtBottom={true}
                >
                    <TextField
                        className={styles.chatSettingsSeparator}
                        defaultValue={promptTemplate}
                        label="Override prompt template"
                        multiline
                        autoAdjustHeight
                        onChange={onPromptTemplateChange}
                    />

                    <SpinButton
                        className={styles.chatSettingsSeparator}
                        label="Retrieve this many documents from search:"
                        min={1}
                        max={50}
                        defaultValue={retrieveCount.toString()}
                        onChange={onRetrieveCountChange}
                    />
                    <TextField className={styles.chatSettingsSeparator} label="Exclude category" onChange={onExcludeCategoryChanged} />
                    <Checkbox
                        className={styles.chatSettingsSeparator}
                        checked={useSemanticRanker}
                        label="Use semantic ranker for retrieval"
                        onChange={onUseSemanticRankerChange}
                    />
                    <Checkbox
                        className={styles.chatSettingsSeparator}
                        checked={useSemanticCaptions}
                        label="Use query-contextual summaries instead of whole documents"
                        onChange={onUseSemanticCaptionsChange}
                        disabled={!useSemanticRanker}
                    />
                    <Checkbox
                        className={styles.chatSettingsSeparator}
                        checked={useSuggestFollowupQuestions}
                        label="Suggest follow-up questions"
                        onChange={onUseSuggestFollowupQuestionsChange}
                    />
                </Panel>
            </div>
        </div>
    );
};

export default Chat;
