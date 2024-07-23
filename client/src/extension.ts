
import { File } from 'buffer';
import * as path from 'path';
import { workspace, ExtensionContext, languages, DefinitionProvider, TextDocument, Position, CancellationToken, Location, Uri } from 'vscode';

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
