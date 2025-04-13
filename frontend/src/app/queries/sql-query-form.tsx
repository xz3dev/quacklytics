import {useEffect, useState} from "react";
import {Button} from "@/components/ui/button";
import {Textarea} from "@/components/ui/textarea";
import {Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle} from "@/components/ui/card";
import {Label} from "@/components/ui/label";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {toast} from "sonner";
import {Info, List, PlayCircle, Save, Trash2} from "lucide-react";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import CodeMirror from '@uiw/react-codemirror';
import {sql} from "@codemirror/lang-sql";
import {useTheme} from "@/components/theme/theme-provider.tsx";

interface SavedQuery {
    id: string;
    name: string;
    query: string;
    args: string[];
    savedAt: string;
}

interface SqlQueryFormProps {
    onSubmit?: (query: string, args: string[]) => void;
    defaultQuery?: string;
    defaultArgs?: string[];
}

const STORAGE_KEY = "saved_sql_queries";

export function SqlQueryForm({
                                 onSubmit,
                                 defaultQuery = "",
                                 defaultArgs = []
                             }: SqlQueryFormProps) {
    const [query, setQuery] = useState<string>(defaultQuery);
    const [args, setArgs] = useState<string>(defaultArgs.join('\n'));
    const [activeTab, setActiveTab] = useState<string>("editor");
    const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
    const [queryName, setQueryName] = useState<string>("");
    const [saveDialogOpen, setSaveDialogOpen] = useState<boolean>(false);

    const theme = useTheme()

    // Load saved queries from localStorage on component mount
    useEffect(() => {
        loadSavedQueries();
        loadLastQuery();
    }, []);

    const loadSavedQueries = () => {
        try {
            const savedQueriesJson = localStorage.getItem(STORAGE_KEY);
            if (savedQueriesJson) {
                const queries = JSON.parse(savedQueriesJson) as SavedQuery[];
                setSavedQueries(queries);
            }
        } catch (error) {
            console.error("Failed to load saved queries:", error);
            toast.error("Failed to load saved queries");
        }
    };

    const loadLastQuery = () => {
        try {
            const lastQueryJson = localStorage.getItem("last_sql_query");
            if (lastQueryJson) {
                const lastQuery = JSON.parse(lastQueryJson);
                setQuery(lastQuery.query || "");
                setArgs(lastQuery.args?.join('\n') || "");
                toast.info("Last query loaded");
            }
        } catch (error) {
            console.error("Failed to load last query:", error);
        }
    };

    const parseArgs = (argsText: string): string[] => {
        return argsText
            .split('\n')
            .map(arg => arg.trim())
            .filter(arg => arg.length > 0);
    };

    const handleSubmit = () => {
        const parsedArgs = parseArgs(args);
        onSubmit?.(query, parsedArgs);

        // Save current query as last used
        localStorage.setItem("last_sql_query", JSON.stringify({
            query,
            args: parsedArgs
        }));

        toast.success("Query executed");
    };

    const handleSaveQuery = () => {
        if (!queryName.trim()) {
            toast.error("Please provide a name for your query");
            return;
        }

        try {
            const parsedArgs = parseArgs(args);
            const newQuery: SavedQuery = {
                id: Date.now().toString(),
                name: queryName,
                query,
                args: parsedArgs,
                savedAt: new Date().toISOString()
            };

            const updatedQueries = [...savedQueries, newQuery];
            setSavedQueries(updatedQueries);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedQueries));

            // Also save as last used query
            localStorage.setItem("last_sql_query", JSON.stringify({
                query,
                args: parsedArgs
            }));

            setQueryName("");
            setSaveDialogOpen(false);
            toast.success("Query saved successfully");
        } catch (error) {
            console.error("Failed to save query:", error);
            toast.error("Failed to save query");
        }
    };

    const handleLoadQuery = (queryId: string) => {
        const selectedQuery = savedQueries.find(q => q.id === queryId);
        if (selectedQuery) {
            setQuery(selectedQuery.query);
            setArgs(selectedQuery.args.join('\n'));
            toast.info(`Loaded query: ${selectedQuery.name}`);
        }
    };

    const handleDeleteQuery = (queryId: string) => {
        try {
            const updatedQueries = savedQueries.filter(q => q.id !== queryId);
            setSavedQueries(updatedQueries);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedQueries));
            toast.success("Query deleted");
        } catch (error) {
            console.error("Failed to delete query:", error);
            toast.error("Failed to delete query");
        }
    };

    const formatDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleString();
        } catch (e) {
            return dateString;
        }
    };

    return (
        <Card className="w-full shadow-md">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-xl">SQL Query Editor</CardTitle>
                        <CardDescription>
                            Define your SQL query and provide arguments (one per line)
                        </CardDescription>
                    </div>
                    <div className="flex gap-2 items-center">
                        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                            <DialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    disabled={!query.trim()}
                                >
                                    <Save className="h-4 w-4 mr-2" />
                                    Save
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Save Query</DialogTitle>
                                    <DialogDescription>
                                        Give your query a name to save it for future use.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="query-name" className="text-right">
                                            Query Name
                                        </Label>
                                        <Input
                                            id="query-name"
                                            value={queryName}
                                            onChange={(e) => setQueryName(e.target.value)}
                                            className="col-span-3"
                                            placeholder="My Important Query"
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline">Cancel</Button>
                                    </DialogClose>
                                    <Button onClick={handleSaveQuery}>Save</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        <Button
                            variant="default"
                            onClick={handleSubmit}
                            disabled={!query.trim()}
                        >
                            <PlayCircle className="h-4 w-4 mr-2" />
                            Execute
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="editor">Query Editor</TabsTrigger>
                        <TabsTrigger value="args">Query Arguments</TabsTrigger>
                        <TabsTrigger value="saved">Saved Queries</TabsTrigger>
                    </TabsList>

                    <TabsContent value="editor" className="space-y-4 mt-2">
                        <div className="grid gap-2">
                            <Label htmlFor="query" className="invisible">Query</Label>
                                {/*// height="150px"*/}
                            <CodeMirror
                                value={query}
                                extensions={[sql()]}
                                theme={theme.effective}
                                onChange={(value) => setQuery(value)}
                                placeholder="SELECT * FROM events WHERE event_type = $1"
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="args" className="space-y-4 mt-2">
                        <div className="grid gap-2">
                            <div className="flex items-center">
                                <Label htmlFor="sql-args">Query Arguments</Label>
                                <div className="ml-2 text-sm text-muted-foreground flex items-center">
                                    <Info className="h-3.5 w-3.5 mr-1" />
                                    <span>One argument per line</span>
                                </div>
                            </div>
                            <Textarea
                                id="sql-args"
                                placeholder="123
example@email.com
2023-01-01"
                                className="font-mono resize-none h-60"
                                value={args}
                                onChange={(e) => setArgs(e.target.value)}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="saved" className="space-y-4 mt-2">
                        {savedQueries.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground">
                                <List className="h-8 w-8 mx-auto mb-2" />
                                <p>No saved queries yet</p>
                                <p className="text-sm mt-1">Save your queries to reuse them later</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {savedQueries.map((savedQuery) => (
                                    <Card key={savedQuery.id} className="overflow-hidden">
                                        <div className="p-3 bg-muted/30 flex justify-between items-center">
                                            <div className="font-medium truncate">{savedQuery.name}</div>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleLoadQuery(savedQuery.id)}
                                                >
                                                    Load
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDeleteQuery(savedQuery.id)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="p-3">
                                            <div className="text-sm font-mono bg-muted/20 p-2 rounded-md overflow-x-auto max-h-20">
                                                {savedQuery.query}
                                            </div>
                                            {savedQuery.args.length > 0 && (
                                                <div className="mt-2">
                                                    <div className="text-xs text-muted-foreground">Arguments:</div>
                                                    <div className="text-sm font-mono bg-muted/20 p-2 rounded-md mt-1 max-h-20 overflow-y-auto">
                                                        {savedQuery.args.join(', ')}
                                                    </div>
                                                </div>
                                            )}
                                            <div className="text-xs text-muted-foreground mt-2">
                                                Saved: {formatDate(savedQuery.savedAt)}
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </CardContent>
            <CardFooter className="flex justify-between bg-muted/30 text-xs text-muted-foreground p-3">
                <div>
                    Query Length: {query.length} characters
                </div>
                <div>
                    Arguments: {parseArgs(args).length}
                </div>
            </CardFooter>
        </Card>
    );
}
