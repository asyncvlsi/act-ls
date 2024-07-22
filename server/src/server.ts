
import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
	DocumentDiagnosticReportKind,
	type DocumentDiagnosticReport
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			// Tell the client that this server supports code completion.
			completionProvider: {
				resolveProvider: true
			},
			diagnosticProvider: {
				interFileDependencies: false,
				workspaceDiagnostics: false
			}
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// The example settings
interface ExampleSettings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <ExampleSettings>(
			(change.settings.languageServerExample || defaultSettings)
		);
	}
	// Refresh the diagnostics since the `maxNumberOfProblems` could have changed.
	// We could optimize things here and re-fetch the setting first can compare it
	// to the existing setting, but this is out of scope for this example.
	connection.languages.diagnostics.refresh();
});

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'languageServerExample'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});


connection.languages.diagnostics.on(async (params) => {
	const document = documents.get(params.textDocument.uri);
	if (document !== undefined) {
		return {
			kind: DocumentDiagnosticReportKind.Full,
			items: await validateTextDocument(document)
		} satisfies DocumentDiagnosticReport;
	} else {
		// We don't know the document. We can either try to read it from disk
		// or we don't report problems for it.
		return {
			kind: DocumentDiagnosticReportKind.Full,
			items: []
		} satisfies DocumentDiagnosticReport;
	}
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<Diagnostic[]> {
	// In this simple example we get the settings for every validate run.
	const settings = await getDocumentSettings(textDocument.uri);

	// The validator creates diagnostics for all uppercase words length 2 and more
	const text = textDocument.getText();
	const pattern = /\b[A-Z]{2,}\b/g;
	let m: RegExpExecArray | null;

	let problems = 0;
	const diagnostics: Diagnostic[] = [];
	while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
		problems++;
		const diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Warning,
			range: {
				start: textDocument.positionAt(m.index),
				end: textDocument.positionAt(m.index + m[0].length)
			},
			message: `${m[0]} is all uppercase.`,
			source: 'ex'
		};
		if (hasDiagnosticRelatedInformationCapability) {
			diagnostic.relatedInformation = [
				{
					location: {
						uri: textDocument.uri,
						range: Object.assign({}, diagnostic.range)
					},
					message: 'Spelling matters'
				},
				{
					location: {
						uri: textDocument.uri,
						range: Object.assign({}, diagnostic.range)
					},
					message: 'Particularly for names'
				}
			];
		}
		diagnostics.push(diagnostic);
	}
	return diagnostics;
}

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received a file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		// The pass parameter contains the position of the text document in
		// which code complete got requested. For the example we ignore this
		// info and always provide the same completion items.
		return [
			{
				label: 'import',
				kind: CompletionItemKind.Text,
				data: 1
			}
			,
			{
				label: 'open',
				kind: CompletionItemKind.Text,
				data: 2
			}
			,
			{
				label: 'template',
				kind: CompletionItemKind.Text,
				data: 3
			}
			,
			{
				label: 'export',
				kind: CompletionItemKind.Text,
				data: 4
			}
			,
			{
				label: 'namespace',
				kind: CompletionItemKind.Text,
				data: 5
			}
			,
			{
				label: 'defproc',
				kind: CompletionItemKind.Text,
				data: 6
			}
			,
			{
				label: 'defcell',
				kind: CompletionItemKind.Text,
				data: 7
			}
			,
			{
				label: 'defchan',
				kind: CompletionItemKind.Text,
				data: 8
			}
			,
			{
				label: 'deftype',
				kind: CompletionItemKind.Text,
				data: 9
			}
			,
			{
				label: 'function',
				kind: CompletionItemKind.Text,
				data: 10
			}
			,
			{
				label: 'log',
				kind: CompletionItemKind.Text,
				data: 11
			}
			,
			{
				label: 'self',
				kind: CompletionItemKind.Text,
				data: 12
			}
			,
			{
				label: 'methods',
				kind: CompletionItemKind.Text,
				data: 13
			}
			,
			{
				label: 'set',
				kind: CompletionItemKind.Text,
				data: 14
			}
			,
			{
				label: 'get',
				kind: CompletionItemKind.Text,
				data: 15
			}
			,
			{
				label: 'send_up',
				kind: CompletionItemKind.Text,
				data: 16
			}
			,
			{
				label: 'recv_up',
				kind: CompletionItemKind.Text,
				data: 17
			}
			,
			{
				label: 'send_rest',
				kind: CompletionItemKind.Text,
				data: 18
			}
			,
			{
				label: 'recv_rest',
				kind: CompletionItemKind.Text,
				data: 19
			}
			,
			{
				label: 'send_probe',
				kind: CompletionItemKind.Text,
				data: 20
			}
			,
			{
				label: 'recv_probe',
				kind: CompletionItemKind.Text,
				data: 21
			}
			,
			{
				label: 'interface',
				kind: CompletionItemKind.Text,
				data: 22
			}
			,
			{
				label: 'skip',
				kind: CompletionItemKind.Text,
				data: 23
			}
			,
			{
				label: 'else',
				kind: CompletionItemKind.Text,
				data: 24
			}
			,
			{
				label: 'bool',
				kind: CompletionItemKind.Text,
				data: 25
			}
			,
			{
				label: 'int',
				kind: CompletionItemKind.Text,
				data: 26
			}
			,
			{
				label: 'pint',
				kind: CompletionItemKind.Text,
				data: 27
			}
			,
			{
				label: 'preal',
				kind: CompletionItemKind.Text,
				data: 28
			}
			,
			{
				label: 'pbool',
				kind: CompletionItemKind.Text,
				data: 29
			}
			,
			{
				label: 'ptype',
				kind: CompletionItemKind.Text,
				data: 30
			}
			,
			{
				label: 'chan',
				kind: CompletionItemKind.Text,
				data: 31
			}
			,
			{
				label: 'enum',
				kind: CompletionItemKind.Text,
				data: 32
			}
			,
			{
				label: 'chp',
				kind: CompletionItemKind.Text,
				data: 33
			}
			,
			{
				label: 'prs',
				kind: CompletionItemKind.Text,
				data: 34
			}
			,
			{
				label: 'hse',
				kind: CompletionItemKind.Text,
				data: 35
			}
			,
			{
				label: 'dataflow',
				kind: CompletionItemKind.Text,
				data: 36
			}
			,
			{
				label: 'dataflow_cluster',
				kind: CompletionItemKind.Text,
				data: 37
			}
			,
			{
				label: 'order',
				kind: CompletionItemKind.Text,
				data: 38
			}
			,
			{
				label: 'refine',
				kind: CompletionItemKind.Text,
				data: 39
			}
			,
			{
				label: 'sizing',
				kind: CompletionItemKind.Text,
				data: 40
			}
			,
			{
				label: 'spec',
				kind: CompletionItemKind.Text,
				data: 41
			}
			,
			{
				label: 'exclhi',
				kind: CompletionItemKind.Text,
				data: 42
			}
			,
			{
				label: 'excllo',
				kind: CompletionItemKind.Text,
				data: 43
			}
			,
			{
				label: 'mk_exclhi',
				kind: CompletionItemKind.Text,
				data: 44
			}
			,
			{
				label: 'mk_excllo',
				kind: CompletionItemKind.Text,
				data: 45
			}
			,
			{
				label: 'timing',
				kind: CompletionItemKind.Text,
				data: 46
			}
			,
			{
				label: 'Vdd',
				kind: CompletionItemKind.Text,
				data: 47
			}
			,
			{
				label: 'GND',
				kind: CompletionItemKind.Text,
				data: 48
			}
			,
			{
				label: 'passp',
				kind: CompletionItemKind.Text,
				data: 49
			}
			,
			{
				label: 'passn',
				kind: CompletionItemKind.Text,
				data: 50
			}
			,
			{
				label: 'keeper',
				kind: CompletionItemKind.Text,
				data: 51
			}
			,
			{
				label: 'cap',
				kind: CompletionItemKind.Text,
				data: 52
			}
			,
			{
				label: 'macro',
				kind: CompletionItemKind.Text,
				data: 53
			}
			,
			{
				label: 'defenum',
				kind: CompletionItemKind.Text,
				data: 54
			}
			,
			{
				label: 'chp-txt',
				kind: CompletionItemKind.Text,
				data: 55
			}
			,
			{
				label: 'transgate',
				kind: CompletionItemKind.Text,
				data: 56
			}
		];
	}
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		if (item.data === 1) {
			item.detail = 'Import a namespace or file';
			item.documentation = '';
		} 
		else if (item.data === 2) {
			item.detail = 'Open a namespace';
			item.documentation = '';
		}
		else if (item.data === 3) {
			item.detail = 'Define a type template';
			item.documentation = '';
		}
		else if (item.data === 4) {
			item.detail = 'Export a namespace or user-defined type';
			item.documentation = '';
		}
		else if (item.data === 5) {
			item.detail = 'Define a namespace';
			item.documentation = '';
		}
		else if (item.data === 6) {
			item.detail = 'Define a process';
			item.documentation = '';
		}
		else if (item.data === 7) {
			item.detail = 'Define a cell';
			item.documentation = '';
		}
		else if (item.data === 8) {
			item.detail = 'Define a channel';
			item.documentation = '';
		}
		else if (item.data === 9) {
			item.detail = 'Define a new type';
			item.documentation = '';
		}
		else if (item.data === 10) {
			item.detail = 'Define a function';
			item.documentation = '';
		}
		else if (item.data === 11) {
			item.detail = 'Built-in chp log function';
			item.documentation = '';
		}
		else if (item.data === 12) {
			item.detail = 'output variable name for functions';
			item.documentation = '';
		}
		else if (item.data === 13) {
			item.detail = 'Methods body for deftype objects';
			item.documentation = 'blah blah';
		}
		else if (item.data === 14) {
			item.detail = 'Method for writing a value to the type';
			item.documentation = '';
		}
		else if (item.data === 15) {
			item.detail = 'Method for reading the value of the type';
			item.documentation = '';
		}
		else if (item.data === 16) {
			item.detail = 'First half of a send synchronization';
			item.documentation = '';
		}
		else if (item.data === 17) {
			item.detail = 'First half of a receive synchronization';
			item.documentation = '';
		}
		else if (item.data === 18) {
			item.detail = 'Complete the rest of the send protocol';
			item.documentation = '';
		}
		else if (item.data === 19) {
			item.detail = 'Complete the rest of the receive protocol';
			item.documentation = '';
		}
		else if (item.data === 20) {
			item.detail = 'Probe operation for sending end';
			item.documentation = '';
		}
		else if (item.data === 21) {
			item.detail = 'Probe operation for receiving end';
			item.documentation = '';
		}
		else if (item.data === 22) {
			item.detail = 'Define an interface for a process';
			item.documentation = '';
		}
		else if (item.data === 23) {
			item.detail = 'Empty chp action that does nothing';
			item.documentation = '';
		}
		else if (item.data === 24) {
			item.detail = 'Special catch-all guard for selections';
			item.documentation = '';
		}
		else if (item.data === 25) {
			item.detail = 'Pre-defined boolean data type';
			item.documentation = '';
		}
		else if (item.data === 26) {
			item.detail = 'Pre-defined integer data type';
			item.documentation = '';
		}
		else if (item.data === 27) {
			item.detail = 'Parametric integer type';
			item.documentation = '';
		}
		else if (item.data === 28) {
			item.detail = 'Parametric real-valued type';
			item.documentation = '';
		}
		else if (item.data === 29) {
			item.detail = 'Parametric boolean type';
			item.documentation = '';
		}
		else if (item.data === 30) {
			item.detail = 'Special meta-parameter type';
			item.documentation = '';
		}
		else if (item.data === 31) {
			item.detail = 'Pre-defined abstract channel type';
			item.documentation = '';
		}
		else if (item.data === 32) {
			item.detail = 'Pre-defined enumeration type';
			item.documentation = '';
		}
		else if (item.data === 33) {
			item.detail = 'Define a CHP sublanguage body';
			item.documentation = '';
		}
		else if (item.data === 34) {
			item.detail = 'Define a PRS sublanguage body';
			item.documentation = '';
		}
		else if (item.data === 35) {
			item.detail = 'Define a HSE sublanguage body';
			item.documentation = '';
		}
		else if (item.data === 36) {
			item.detail = 'Define a Dataflow sublanguage body';
			item.documentation = '';
		}
		else if (item.data === 37) {
			item.detail = 'Group dataflow elements together';
			item.documentation = '';
		}
		else if (item.data === 38) {
			item.detail = 'Define a computation order for a dataflow body';
			item.documentation = '';
		}
		else if (item.data === 39) {
			item.detail = 'Define a refinement body';
			item.documentation = '';
		}
		else if (item.data === 40) {
			item.detail = 'Define a sizing body';
			item.documentation = '';
		}
		else if (item.data === 41) {
			item.detail = 'Define a specification body';
			item.documentation = '';
		}
		else if (item.data === 42) {
			item.detail = 'Assert that two signals are exclusive-high';
			item.documentation = '';
		}
		else if (item.data === 43) {
			item.detail = '';
			item.documentation = 'Assert that two signals are exclusive-low';
		}
		else if (item.data === 44) {
			item.detail = 'Force two signals to be exclusive-high in simulation';
			item.documentation = '';
		}
		else if (item.data === 45) {
			item.detail = 'Force two signals to be exclusive-low in simulation';
			item.documentation = '';
		}
		else if (item.data === 46) {
			item.detail = 'Define a timing body';
			item.documentation = '';
		}
		else if (item.data === 47) {
			item.detail = 'Global Vdd signal';
			item.documentation = '';
		}
		else if (item.data === 48) {
			item.detail = 'Global ground signal';
			item.documentation = '';
		}
		else if (item.data === 49) {
			item.detail = 'PMOS pass transistor (G,S,D)';
			item.documentation = '';
		}
		else if (item.data === 50) {
			item.detail = 'NMOS pass transistor (G,S,D)';
			item.documentation = '';
		}
		else if (item.data === 51) {
			item.detail = 'Keeper type for production rule [0/1/2/3]';
			item.documentation = '';
		}
		else if (item.data === 52) {
			item.detail = 'Capacitor';
			item.documentation = '';
		}
		else if (item.data === 53) {
			item.detail = 'Define a macro';
			item.documentation = '';
		}
		else if (item.data === 54) {
			item.detail = 'Define an enumeration';
			item.documentation = '';
		}
		else if (item.data === 55) {
			item.detail = 'Define a CHP-TXT sublanguage body';
			item.documentation = '';
		}
		else if (item.data === 56) {
			item.detail = 'Transmission gate (Gn,Gp,S,D)';
			item.documentation = 'blah';
		}
		return item;
	}
);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
