
import { File } from 'buffer';
import * as path from 'path';
import { workspace, ExtensionContext, languages, DefinitionProvider, TextDocument, Position, CancellationToken, Location, Uri, Hover } from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind,
	Range
} from 'vscode-languageclient/node';

let client: LanguageClient;

// class ACTDefinitionProvider implements DefinitionProvider {
//     public provideDefinition(
//         document: TextDocument, position: Position, token: CancellationToken):
//         Thenable<Location> {
// 			return new Promise((resolve) => {
// 				console.log(position);
// 				const range = Range.create(document.positionAt(0), document.positionAt(10));
// 				console.log(range.start,range.end);
// 				console.log(document.uri);
// 				// new Location(document.uri,position);
// 				new Location(Uri.file("/Users/karthisrinivasan/Documents/act_tools/act/globals.act"), position);
// 			});
//     }
// }

export function activate(context: ExtensionContext) {
	// The server is implemented in node
	const serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
		}
	};

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: 'file', language: 'act' }],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	context.subscriptions.push(
		languages.registerHoverProvider('act', {
			provideHover(document, position, token) {

				const range = document.getWordRangeAtPosition(position);
				const word = document.getText(range);

				// console.log(`Word cursor hovered: ${word}`);

				// Create the hover object
				var hover;
				if (word === "import") {
					hover = new Hover("Import a namespace or file");
				} 
				else if (word === "open") {
					hover = new Hover("Open a namespace");
				}
				else if (word === "template") {
					hover = new Hover("Define a type template");
				}
				else if (word === "export") {
					hover = new Hover("Export a namespace or user-defined type");
				}
				else if (word === "namespace") {
					hover = new Hover("Define a namespace");
				}
				else if (word === "defproc") {
					hover = new Hover("Define a process");
				}
				else if (word === "defcell") {
					hover = new Hover("Define a cell");
				}
				else if (word === "defchan") {
					hover = new Hover("Define a channel");
				}
				else if (word === "deftype") {
					hover = new Hover("Define a new type");
				}
				else if (word === "function") {
					hover = new Hover("Define a function");
				}
				else if (word === "log") {
					hover = new Hover("Built-in chp log function");
				}
				else if (word === "self") {
					hover = new Hover("output variable name for functions");
				}
				else if (word === "methods") {
					hover = new Hover("Methods body for deftype objects");
				}
				else if (word === "set") {
					hover = new Hover("Method for writing a value to the type");
				}
				else if (word === "get") {
					hover = new Hover("Method for reading the value of the type");
				}
				else if (word === "send_up") {
					hover = new Hover("First half of a send synchronization");
				}
				else if (word === "recv_up") {
					hover = new Hover("First half of a receive synchronization");
				}
				else if (word === "send_rest") {
					hover = new Hover("Complete the rest of the send protocol");
				}
				else if (word === "recv_rest") {
					hover = new Hover("Complete the rest of the receive protocol");
				}
				else if (word === "send_probe") {
					hover = new Hover("Probe operation for sending end");
				}
				else if (word === "recv_probe") {
					hover = new Hover("Probe operation for receiving end");
				}
				else if (word === "interface") {
					hover = new Hover("Define an interface for a process");
				}
				else if (word === "skip") {
					hover = new Hover("Empty chp action that does nothing");
				}
				else if (word === "else") {
					hover = new Hover("Special catch-all guard for selections");
				}
				else if (word === "bool") {
					hover = new Hover("Pre-defined boolean data type");
				}
				else if (word === "int") {
					hover = new Hover("Pre-defined integer data type");
				}
				else if (word === "pint") {
					hover = new Hover("Parametric integer type");
				}
				else if (word === "preal") {
					hover = new Hover("Parametric real-valued type");
				}
				else if (word === "pbool") {
					hover = new Hover("Parametric boolean type");
				}
				else if (word === "ptype") {
					hover = new Hover("Special meta-parameter type");
				}
				else if (word === "chan") {
					hover = new Hover("Pre-defined abstract channel type");
				}
				else if (word === "enum") {
					hover = new Hover("Pre-defined enumeration type");
				}
				else if (word === "chp") {
					hover = new Hover("Define a CHP sublanguage body");
				}
				else if (word === "prs") {
					hover = new Hover("Define a PRS sublanguage body");
				}
				else if (word === "hse") {
					hover = new Hover("Define a HSE sublanguage body");
				}
				else if (word === "dataflow") {
					hover = new Hover("Define a Dataflow sublanguage body");
				}
				else if (word === "dataflow_cluster") {
					hover = new Hover("Group dataflow elements together");
				}
				else if (word === "order") {
					hover = new Hover("Define a computation order for a dataflow body");
				}
				else if (word === "refine") {
					hover = new Hover("Define a refinement body");
				}
				else if (word === "sizing") {
					hover = new Hover("Define a sizing body");
				}
				else if (word === "spec") {
					hover = new Hover("Define a specification body");
				}
				else if (word === "exclhi") {
					hover = new Hover("Assert that two signals are exclusive-high");
				}
				else if (word === "excllo") {
					hover = new Hover("Assert that two signals are exclusive-low");
				}
				else if (word === "mk_exclhi") {
					hover = new Hover("Force two signals to be exclusive-high in simulation");
				}
				else if (word === "mk_excllo") {
					hover = new Hover("Force two signals to be exclusive-low in simulation");
				}
				else if (word === "timing") {
					hover = new Hover("Define a timing body");
				}
				else if (word === "Vdd") {
					hover = new Hover("Global Vdd signal");
				}
				else if (word === "GND") {
					hover = new Hover("Global ground signal");
				}
				else if (word === "passp") {
					hover = new Hover("PMOS pass transistor (G,S,D)");
				}
				else if (word === "passn") {
					hover = new Hover("NMOS pass transistor (G,S,D)");
				}
				else if (word === "keeper") {
					hover = new Hover("Keeper type for production rule [0/1/2/3]");
				}
				else if (word === "cap") {
					hover = new Hover("Capacitor");
				}
				else if (word === "macro") {
					hover = new Hover("Define a macro");
				}
				else if (word === "defenum") {
					hover = new Hover("Define an enumeration");
				}
				else if (word === "chp-txt") {
					hover = new Hover("Define a CHP-TXT sublanguage body");
				}
				else if (word === "transgate") {
					hover = new Hover("Transmission gate (Gn,Gp,S,D)");
				}
				else {
					hover = undefined;
				}
				return hover;
			}
		}
	))
	// context.subscriptions.push(languages.registerDefinitionProvider(
	// 		[{ scheme: 'file', language: 'plaintext' }], new ACTDefinitionProvider()))

	// Create the language client and start the client.
	client = new LanguageClient(
		'languageServerExample',
		'Language Server Example',
		serverOptions,
		clientOptions
	);

	// Start the client. This will also launch the server
	client.start();
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
