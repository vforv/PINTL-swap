"use strict";
const express = require("express");
const compression = require("compression");
const helmet = require("helmet");
var hpp = require("hpp");
var Ddos = require("ddos");

const _port = 8080;
const _app_folder = "dist/";
var ddos = new Ddos({ burst: 20, limit: 25 });

const app = express();
// app.use(header_secure);
app.use(ddos.express);
// app.use(helmet({
//     contentSecurityPolicy: false,
//     crossOriginEmbedderPolicy: false,
//     referrerPolicy: false,
// }));
  
app.use(helmet.hidePoweredBy({ setTo: "PHP 4.5.0" }));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ limit: "5mb" }));
app.use(hpp());

app.use(compression());

// ---- SERVE STATIC FILES ---- //
app.get("*.*", express.static(_app_folder, { maxAge: "1y" }));

// ---- SERVE APLICATION PATHS ---- //
app.all("*", function (req, res) {
  res.status(200).sendFile(`/`, { root: _app_folder });
});

// ---- START UP THE NODE SERVER  ----
app.listen(_port, function () {
  console.log(
    "Node Express server for " +
      app.name +
      " listening on http://localhost:" +
      _port
  );
});
