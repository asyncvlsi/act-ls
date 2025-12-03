
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
	type DocumentDiagnosticReport,
	TextDocumentIdentifier,
	Definition,
	Location,
	URI,
	DocumentUri,
	LocationLink,
	Range,
	MarkedString,
	MarkupContent,
	MarkupKind
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

// import { ReferenceManager } from './reference-manager';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// const refManager: ReferenceManager = new ReferenceManager(documents, connection);

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
			// ,
			// definitionProvider : true
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	};
	if (hasWorkspaceFolderCapability) {
		// refManager.updateWorkspaceReferences(params.workspaceFolders!) ;
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
			// items: await validateTextDocument(document)
			items: []
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
// documents.onDidChangeContent(change => {
// 	validateTextDocument(change.document);
// 	// refManager.updateDocumentReferences(change.document.uri);
// });

// async function validateTextDocument(textDocument: TextDocument): Promise<Diagnostic[]> {
// 	// In this simple example we get the settings for every validate run.
// 	const settings = await getDocumentSettings(textDocument.uri);

// 	// The validator creates diagnostics for all uppercase words length 2 and more
// 	const text = textDocument.getText();
// 	const pattern = /\b[A-Z]{2,}\b/g;
// 	let m: RegExpExecArray | null;

// 	let problems = 0;
// 	const diagnostics: Diagnostic[] = [];
// 	while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
// 		problems++;
// 		const diagnostic: Diagnostic = {
// 			severity: DiagnosticSeverity.Warning,
// 			range: {
// 				start: textDocument.positionAt(m.index),
// 				end: textDocument.positionAt(m.index + m[0].length)
// 			},
// 			message: `${m[0]} is all uppercase.`,
// 			source: 'ex'
// 		};
// 		if (hasDiagnosticRelatedInformationCapability) {
// 			diagnostic.relatedInformation = [
// 				{
// 					location: {
// 						uri: textDocument.uri,
// 						range: Object.assign({}, diagnostic.range)
// 					},
// 					message: 'Spelling matters'
// 				},
// 				{
// 					location: {
// 						uri: textDocument.uri,
// 						range: Object.assign({}, diagnostic.range)
// 					},
// 					message: 'Particularly for names'
// 				}
// 			];
// 		}
// 		diagnostics.push(diagnostic);
// 	}
// 	return diagnostics;
// }

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
			,
			{
				label: 'defptype',
				kind: CompletionItemKind.Text,
				data: 57
			}
			,
			{
				label: 'warn',
				kind: CompletionItemKind.Text,
				data: 58
			}
			,
			{
				label: 'assert',
				kind: CompletionItemKind.Text,
				data: 59
			}
			,
			{
				label: 'log_st',
				kind: CompletionItemKind.Text,
				data: 60
			}
			,
			{
				label: 'log_p',
				kind: CompletionItemKind.Text,
				data: 61
			}
			,
			{
				label: 'log_nl',
				kind: CompletionItemKind.Text,
				data: 62
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
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- Syntax: `import <namespace/file>`',
				'- The namespace or file must be in the path specified by the ACT_PATH environment variable.',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:namespaces)'
				].join('\n') };
			item.documentation = contents;
		} 
		else if (item.data === 2) {
			item.detail = 'Open a namespace or ACT file';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- Syntax: `open <namespace/file>`',
				'- The namespace or file must be in the path specified by the ACT_PATH environment variable.',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:namespaces)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 3) {
			item.detail = 'Define a type template';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- Example Syntax: `template <pint W> defproc source (chan!(int<W>) C) { chp { *[C!0] } }`',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:types2)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 4) {
			item.detail = 'Export a namespace or user-defined type';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- Syntax: `export ...`',
				'- Prefix the declaration of a user-defined type or namespace to make it visible in the parent namespace.',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:namespaces)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 5) {
			item.detail = 'Define a namespace';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- Syntax: `namespace <name> { ... }`',
				'- Similar to the one used in C++.',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:namespaces)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 6) {
			item.detail = 'Define a new process';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- Syntax: `defproc p (<ports>) { <body> }`',
				'- User-defined type that corresponds to a circuit entity, similar to a module/subcircuit.',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:types2:proc)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 7) {
			item.detail = 'Define a new cell';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- Syntax: `defcell c (<ports>) { <body> }`',
				'- For the tools to treat a `defcell` as a cell, it must be self-contained, i.e. not instantiate other circuits within it.',
				'- Essentially, a cell usually consists only of boolean declarations and a prs body.',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:types2:proc)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 8) {
			item.detail = 'Define a new channel type';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- Syntax: `defchan c_t [ <: impl_chantype ] (<members>) { <connections>, <spec body>, <methods body> } `',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:types2:chan)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 9) {
			item.detail = 'Define a new type';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- Syntax: `deftype t [ <: impl_type ] (<members>) { <connections>, <spec body>, <methods body> } `',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:types2:data)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 10) {
			item.detail = 'Define a function';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- Syntax: `function <name> (<args>) : <ret-type> { <decls>; chp { ... } }`',
				'- If all arguments and return type are parametric, this is typically used for computing parameters needed when constructing the circuit.',
				'- If all are non-parametric, this is typically used for computing run-time expressions.',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:expressions)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 11) {
			item.detail = 'Built-in chp log function';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- Syntax: `log("Hello, hex: %x , binary: %b", x, y)`',
				'- Only in a CHP body',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:langs:chp)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 12) {
			item.detail = 'output variable name for functions';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- The special variable self can be used in the body of the CHP language, and its value on termination of the CHP program indicates the return value.',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:types2:data)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 13) {
			item.detail = 'Methods body for deftype objects';
			item.documentation = '';
		}
		else if (item.data === 14) {
			item.detail = 'Special method for writing a value to the type';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:types2:data)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 15) {
			item.detail = 'Special method for reading the value of the type';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:types2:data)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 16) {
			item.detail = 'First half of a send synchronization';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:types2:chan)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 17) {
			item.detail = 'First half of a receive synchronization';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:types2:chan)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 18) {
			item.detail = 'Complete the rest of the send protocol';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:types2:chan)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 19) {
			item.detail = 'Complete the rest of the receive protocol';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:types2:chan)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 20) {
			item.detail = 'Probe operation for sending end';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:types2:chan)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 21) {
			item.detail = 'Probe operation for receiving end';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:types2:chan)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 22) {
			item.detail = 'Define an interface for a process';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:interface)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 23) {
			item.detail = 'Empty chp action that does nothing';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:langs:chp)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 24) {
			item.detail = 'Special catch-all guard for selections';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- Can only appear as last guard in a selection.',
				'- Selections are blocking by default, and `else -> skip` can be used to explicitly add a skip branch.',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:langs:chp)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 25) {
			item.detail = 'Pre-defined boolean data type';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- Use `bool x;` to declare a Boolean `x`',
				'- Use `bool(expr)` to convert an expression to a Boolean expression.', 
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 26) {
			item.detail = 'Pre-defined integer data type';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- Use `int<W> x;` to declare a integer `x` of width `W` bits.',
				'- Use `int(expr,W)` to convert an expression to integer of `W` bits. This takes the bottom `W` bits of the expression.', 
				'- Use `int(pure_struct_object)` to convert a pure-structure object to its integer representation, i.e. concatenation of fields.',
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 27) {
			item.detail = 'Parametric integer type';
			const contents: MarkupContent = { kind: 'markdown',
			value: [
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:types)'
				].join('\n') }; 
			item.documentation = contents;
		}
		else if (item.data === 28) {
			item.detail = 'Parametric real-valued type';
			const contents: MarkupContent = { kind: 'markdown',
			value: [
				'- Uses 64-bit signed integer arithmetic internally',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:types)'
				].join('\n') }; 
			item.documentation = contents;
		}
		else if (item.data === 29) {
			item.detail = 'Parametric boolean type';
			const contents: MarkupContent = { kind: 'markdown',
			value: [
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:types)'
				].join('\n') }; 
			item.documentation = contents;
		}
		else if (item.data === 30) {
			item.detail = 'Special meta-parameter type';
			const contents: MarkupContent = { kind: 'markdown',
			value: [
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:interface)'
				].join('\n') }; 
			item.documentation = contents;
		}
		else if (item.data === 31) {
			item.detail = 'Pre-defined abstract channel type';
			const contents: MarkupContent = { kind: 'markdown',
			value: [
				'- Syntax: `chan(datatype) C;`',
				'- Recommended to specify direction in port-list: `chan!(datatype) C;` for output channels, `chan?(datatype) C;` for input channels.',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:langs:chp)'
			].join('\n') }; 
			item.documentation = contents;
		}
		else if (item.data === 32) {
			item.detail = 'Pre-defined enumeration type';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- Syntax: `enum<N> x;`',
				'- The variable `x` can take on values from `0` to `N-1`.',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:types)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 33) {
			item.detail = 'Define a CHP sublanguage body';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- Send: `C!expr`',
				'- Receive: `C?var`',
				'- Assignment: `var:=expr`',
				'- Sequence: `S1;S2;...;Sn`',
				'- Parallel: `S1,S2,..,Sn` or `S1 || S2 || ... || Sn`',
				'- Selection: `[ g1 -> S1 [] g2 -> S2 ... [] gn -> Sn]` with optional `else -> Sn` as last',
				'- Non-deterministic Selection: `[| g1 -> S1 [] g2 -> S2 ... [] gn -> Sn|]` with optional `else -> Sn` as last',
				'- Loop: `*[ g1 -> S1 [] g2 -> S2 ... [] gn -> Sn]`',
				'- Do-while Loop: `*[ S <- g ]`',
				'- Infinite loop (shorthand): `*[ S ]`',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:langs:chp)'
				].join('\n') }; 
			item.documentation = contents;
		}
		else if (item.data === 34) {
			item.detail = 'Define a PRS sublanguage body';
			const contents: MarkupContent = { kind: 'markdown',
			value: [
				'- Syntax: `prs { <list of production rules, one per line> } ` ',
				'- One-sided production rule: `a<W1> & b<W2> -> c-`',
				'- Combinational production rule: `a<W1,L1> & b<W2,L2> => c-`',
				'- C-element production rule: `a & b #> c-`',
				'- Ordering of transistors in the implemented pull-up/pull-down network is: left-to-right corresponds to supply-to-output',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:langs:prs)'
				].join('\n') }; 
			item.documentation = contents;
		}
		else if (item.data === 35) {
			item.detail = 'Define a HSE sublanguage body';
			const contents: MarkupContent = { kind: 'markdown',
			value: [
				'- Syntax: `hse { <same as CHP but only bools and no channel actions> }`',
				'- Example of four-phase dataless sink: `*[ [C.r]; C.a+; [~C.r]; C.a- ]`',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:langs:hse)'
				].join('\n') }; 
			item.documentation = contents;
		}
		else if (item.data === 36) {
			item.detail = 'Define a Dataflow sublanguage body';
			const contents: MarkupContent = { kind: 'markdown',
			value: [
				'- Syntax: `dataflow { [ order {...} ] <list of dataflow statements, semicolon-separated> }`',
				'- Source: `VAL -> chan`',
				'- Sink: `chan -> *`',
				'- F-Block: ` a + b -> [N_BUFFERS, INIT_VAL] c`',
				'- Split: `{c} I -> O1, O2`',
				'- Controlled Merge: `{c} I0, I1 -> O`',
				'- Deterministic Merge: `{*} I0, I1 -> O`',
				'- Non-Deterministic Merge: `{|} I0, I1 -> O`',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:langs:dflow)'
				].join('\n') }; 
			item.documentation = contents;
		}
		else if (item.data === 37) {
			item.detail = 'Group dataflow elements together';
			const contents: MarkupContent = { kind: 'markdown',
			value: [
				'- Syntax: `dataflow_cluster { <list of dataflow statements, semicolon-separated> }`',
				'- Hint to the implementation to group these dataflow elements together.',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:langs:dflow)'
				].join('\n') }; 
			item.documentation = contents;
		}
		else if (item.data === 38) {
			item.detail = 'Specify a computation order for a dataflow body';
			const contents: MarkupContent = { kind: 'markdown',
			value: [
				'- Syntax: `order { <list of order directives, semicolon separated> }`',
				'- Specify which outputs must be produced before some input is available, eg. o1 < i2',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:langs:dflow)'
				].join('\n') }; 
			item.documentation = contents;
		}
		else if (item.data === 39) {
			item.detail = 'Define a refinement body';
			const contents: MarkupContent = { kind: 'markdown',
			value: [
				'- Syntax: `refine <level> +{ <refine overrides> } { ... }`',
				'- Used to provide an implementation of a process that replaces the original specification of the process',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:langs:refine)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 40) {
			item.detail = 'Define a sizing body';
			const contents: MarkupContent = { kind: 'markdown',
			value: [
				'- Syntax: `sizing { <list of sizing directives, semicolon separated> }`',
				'- Can specify sizing, leak adjustment, p-n ratio, size of unit n-transistor etc.',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:langs:sizing)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 41) {
			item.detail = 'Define a specification body';
			const contents: MarkupContent = { kind: 'markdown',
			value: [
				'- Syntax: `spec { <list of specifications, one per line> }`',
				'- Used for specifying timing constraints, exclusive directives, simulation directives etc.',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:langs:spec)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 42) {
			item.detail = 'Assert that two signals are exclusive-high';
			const contents: MarkupContent = { kind: 'markdown',
			value: [
				'- Syntax: `exclhi(node1,node2)`',
				'- Violations can be detected with `-m` option in `actsim`.',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:langs:spec)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 43) {
			item.detail = 'Assert that two signals are exclusive-low';
			const contents: MarkupContent = { kind: 'markdown',
			value: [
				'- Syntax: `excllo(node1,node2)`',
				'- Violations can be detected with `-m` option in `actsim`.',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:langs:spec)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 44) {
			item.detail = 'Force two signals to be exclusive-high in simulation';
			const contents: MarkupContent = { kind: 'markdown',
			value: [
				'- Syntax: `mk_exclhi(node1,node2)`',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:langs:spec)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 45) {
			item.detail = 'Force two signals to be exclusive-low in simulation';
			const contents: MarkupContent = { kind: 'markdown',
			value: [
				'- Syntax: `mk_excllo(node1,node2)`',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:langs:spec)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 46) {
			item.detail = 'Specify a timing constraint';
			const contents: MarkupContent = { kind: 'markdown',
			value: [
				'- Syntax for ticked edge: `timing x+ -> y-`',
				'- Syntax for timing fork: `timing x+ : y- < z-`',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:langs:spec)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 47) {
			item.detail = 'Global Vdd signal';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=stdlib:globals)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 48) {
			item.detail = 'Global ground signal';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=stdlib:globals)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 49) {
			item.detail = 'Define a p-type pass transistor';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- Syntax: `passp<W,L,flavor>(gate,src,drain)`',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=tools:netgen)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 50) {
			item.detail = 'Define an n-type pass transistor';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- Syntax: `passn<W,L,flavor>(gate,src,drain)`',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=tools:netgen)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 51) {
			item.detail = 'Specify the type of auto-generated staticizer';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- Syntax: `[keeper=0/1/2/3] <production rule>`',
				'- 0 : Do not generate keeper',
				'- 1 : Default, generates if state-holding gate',
				'- 2 : Looks like state-holding but is actually combinational',
				'- 3 : H-topology C-element keeper (only for gates using `#>`',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=tools:netgen)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 52) {
			item.detail = 'Define a capacitor ';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- Syntax: `cap<SZ1,SZ2> (node1,node2);`',
				'- Define a capacitor of `SZ1*SZ2` units between nodes `node1` and `node2`.',
				'- Both sizes are assumed to be `1` if unspecified',
				'- Only within a `prs` body.',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:langs:prs)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 53) {
			item.detail = 'Define a macro';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- Can be defined for any user-defined type (except parameter structures)`',
				'- Essentially a chp fragment that is substituted in place where it is used.',
				'- Basic Syntax: `defproc p () { methods { macro <name> (int <arg>) { <macro_body> } } }`',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:types2)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 54) {
			item.detail = 'Define a new enumeration type';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- Syntax: `defenum myenum {ADD, SUB, MULT};`',
				'- Cannot assign variable of `myenum` type to an int - this will result in an error',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:types2:data)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 55) {
			item.detail = 'Define a CHP-TXT sublanguage body';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- Send: `send(Channel,expr)`',
				'- Receive: `recv(Channel,variable)`',
				'- Conditional: `select {case g1 : S1; case g2 : S2; ... case gn: Sn}` with optional `else : Sn` as last',
				'- Wait for condition: `wait-for(condition)`',
				'- While loop: `while (G) { S }`',
				'- While loop with multiple guards: `while {case g1 : S1; case g2 : S2; ... case gn: Sn}`',
				'- Infinite loop: `forever { S }`',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:langs:chp)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 56) {
			item.detail = 'Define a transmission gate';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- Syntax: `transgate(ngate,pgate,source,drain) x;`',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=tools:netgen)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 57) {
			item.detail = 'Define a parameter structure';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- Convenient wrapper for a group of parameters (pints, pbools, preals) to simplify templates',
				'- Example: `defptype pt (pint a; pint b);`',
				'- You can now use an object of type `pt` as a template parameter: `template<pt x_pt> defproc p () {}`.',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:types2:data)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 58) {
			item.detail = 'Built-in chp warning function';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- Syntax: `warning(string)`',
				'- Produce a runtime warning',
				'- Only in a CHP body',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:langs:chp)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 59) {
			item.detail = 'Built-in chp assert function';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- Syntax: `assert(expr,string)`',
				'- Perform a runtime assertion.',
				'- For static assertion that is performed during circuit construction, see: [Assertions](https://avlsi.csl.yale.edu/act/doku.php?id=intro_example:assertions) ',
				'- Only in a CHP body',
				'- Integer expressions are treated as false only if they evaluate to zero.',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:langs:chp)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 60) {
			item.detail = 'Start multi-line log in chp';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- Syntax: `log_st()`',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:langs:chp)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 61) {
			item.detail = 'Append to multi-line log in chp';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- Syntax: `log_p(item1, item2, ...)`',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:langs:chp)'
				].join('\n') };
			item.documentation = contents;
		}
		else if (item.data === 62) {
			item.detail = 'New line in multi-line log in chp';
			const contents: MarkupContent = { kind: 'markdown',
			value: ['- Syntax: `log_nl()`',
				'- [Documentation](https://avlsi.csl.yale.edu/act/doku.php?id=language:langs:chp)'
				].join('\n') };
			item.documentation = contents;
		}
		return item;
	}
);

// connection.onDefinition((params) => {
// 	const uri = params.textDocument.uri;
// 	const document = documents.get(uri);
	// const {parser, parseTree, visitor} = ensureParsed(document);
	// const pos = params.position;
	// if (document) {
	// 	const range = Range.create(document.positionAt(0), document.positionAt(10));
		// return Location.create(uri, {
		// 	start: { line: 2, character: 5 },
		// 	end: { line: 2, character: 6 }
		//   });
	// }
	// return (Location,undefined) as Promise<Location>;
	// return  as Promise<Location[]>;
	// return pos;
	// const position = computeTokenPosition(parseTree, parser.inputStream,
	// 	{ line: pos.line + 1, column: pos.character });
	// const position = 
	// if(position && position.context) {
	// 	const scope = getScope(position.context, visitor.symbolTable);
	// 	const definition = findDefinition(position.context.text, scope);
	// 	if(definition && definition.location) {
	// 		return {...definition.location, originSelectionRange: getRange(position.context) };
	// 	}
	// }
// 	return undefined;
// });

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
