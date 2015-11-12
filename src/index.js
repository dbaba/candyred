'use strict';

import 'source-map-support/register';
import http from 'http';
import express from 'express';
import RED from 'node-red';

// Create an Express app
let app = express();

// Create a server
let server = http.createServer(app);

// Create the settings object - see default settings.js file for other options
let settings = {
  verbose: true,
  disableEditor: false,
  httpAdminRoot: '/red',
  httpNodeRoot: '/api',
  userDir: (process.env.HOME || process.env.USERPROFILE) + '/.node-red',
  functionGlobalContext: { }    // enables global context
};

// Initialise the runtime with a server and settings
RED.init(server, settings);

// Add a simple route for static content served from 'public'
app.use('/', express.static('public'));
if (settings.httpAdminRoot) {
  app.get('/', (_, res) => {
    res.redirect(settings.httpAdminRoot);
  });
}

// Serve the editor UI from /red
app.use(settings.httpAdminRoot, RED.httpAdmin);

// Serve the http nodes UI from /api
app.use(settings.httpNodeRoot, RED.httpNode);

server.listen(8000);

// Start the runtime
RED.start();
