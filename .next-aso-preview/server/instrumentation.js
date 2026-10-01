"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "instrumentation";
exports.ids = ["instrumentation"];
exports.modules = {

/***/ "(instrument)/./instrumentation.ts":
/*!****************************!*\
  !*** ./instrumentation.ts ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   register: () => (/* binding */ register)\n/* harmony export */ });\n/**\r\n * Next.js instrumentation entrypoint.\r\n * Runtime-specific Node code lives in instrumentation.node.ts so Edge builds never trace\r\n * pg, crypto, path or the native Swiss Ephemeris addon.\r\n */ async function register() {\n    if (process.env.NEXT_PUBLIC_MOBILE_BUILD === '1') return;\n    if (true) {\n        try {\n            await Promise.all(/*! import() */[__webpack_require__.e(\"vendor-chunks/date-fns\"), __webpack_require__.e(\"vendor-chunks/swisseph-v2\"), __webpack_require__.e(\"vendor-chunks/openai\"), __webpack_require__.e(\"vendor-chunks/axios\"), __webpack_require__.e(\"vendor-chunks/date-fns-tz\"), __webpack_require__.e(\"vendor-chunks/asynckit\"), __webpack_require__.e(\"vendor-chunks/math-intrinsics\"), __webpack_require__.e(\"vendor-chunks/es-errors\"), __webpack_require__.e(\"vendor-chunks/call-bind-apply-helpers\"), __webpack_require__.e(\"vendor-chunks/debug\"), __webpack_require__.e(\"vendor-chunks/get-proto\"), __webpack_require__.e(\"vendor-chunks/mime-db\"), __webpack_require__.e(\"vendor-chunks/has-symbols\"), __webpack_require__.e(\"vendor-chunks/gopd\"), __webpack_require__.e(\"vendor-chunks/function-bind\"), __webpack_require__.e(\"vendor-chunks/form-data\"), __webpack_require__.e(\"vendor-chunks/follow-redirects\"), __webpack_require__.e(\"vendor-chunks/proxy-from-env\"), __webpack_require__.e(\"vendor-chunks/supports-color\"), __webpack_require__.e(\"vendor-chunks/ms\"), __webpack_require__.e(\"vendor-chunks/mime-types\"), __webpack_require__.e(\"vendor-chunks/hasown\"), __webpack_require__.e(\"vendor-chunks/has-tostringtag\"), __webpack_require__.e(\"vendor-chunks/has-flag\"), __webpack_require__.e(\"vendor-chunks/get-intrinsic\"), __webpack_require__.e(\"vendor-chunks/es-set-tostringtag\"), __webpack_require__.e(\"vendor-chunks/es-object-atoms\"), __webpack_require__.e(\"vendor-chunks/es-define-property\"), __webpack_require__.e(\"vendor-chunks/dunder-proto\"), __webpack_require__.e(\"vendor-chunks/delayed-stream\"), __webpack_require__.e(\"vendor-chunks/combined-stream\"), __webpack_require__.e(\"_instrument_instrumentation_node_ts\")]).then(__webpack_require__.bind(__webpack_require__, /*! ./instrumentation.node */ \"(instrument)/./instrumentation.node.ts\"));\n        } catch (error) {\n            // Background workers must never prevent the HTTP server from becoming live.\n            console.warn('[instrumentation] optional Node bootstrap failed; HTTP startup continues:', error instanceof Error ? error.message : error);\n        }\n    }\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKGluc3RydW1lbnQpLy4vaW5zdHJ1bWVudGF0aW9uLnRzIiwibWFwcGluZ3MiOiI7Ozs7QUFBQTs7OztDQUlDLEdBQ00sZUFBZUE7SUFDcEIsSUFBSUMsUUFBUUMsR0FBRyxDQUFDQyx3QkFBd0IsS0FBSyxLQUFLO0lBQ2xELElBQUlGLElBQXFDLEVBQUU7UUFDekMsSUFBSTtZQUNGLE1BQU0scXlEQUFnQztRQUN4QyxFQUFFLE9BQU9JLE9BQU87WUFDZCw0RUFBNEU7WUFDNUVDLFFBQVFDLElBQUksQ0FDViw2RUFDQUYsaUJBQWlCRyxRQUFRSCxNQUFNSSxPQUFPLEdBQUdKO1FBRTdDO0lBQ0Y7QUFDRiIsInNvdXJjZXMiOlsiQzpcXFVzZXJzXFx1c2VyXFxsdW1pYVxcQVNUUk9ULU5FV1xcaW5zdHJ1bWVudGF0aW9uLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBOZXh0LmpzIGluc3RydW1lbnRhdGlvbiBlbnRyeXBvaW50LlxyXG4gKiBSdW50aW1lLXNwZWNpZmljIE5vZGUgY29kZSBsaXZlcyBpbiBpbnN0cnVtZW50YXRpb24ubm9kZS50cyBzbyBFZGdlIGJ1aWxkcyBuZXZlciB0cmFjZVxyXG4gKiBwZywgY3J5cHRvLCBwYXRoIG9yIHRoZSBuYXRpdmUgU3dpc3MgRXBoZW1lcmlzIGFkZG9uLlxyXG4gKi9cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlZ2lzdGVyKCkge1xyXG4gIGlmIChwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19NT0JJTEVfQlVJTEQgPT09ICcxJykgcmV0dXJuO1xyXG4gIGlmIChwcm9jZXNzLmVudi5ORVhUX1JVTlRJTUUgPT09ICdub2RlanMnKSB7XHJcbiAgICB0cnkge1xyXG4gICAgICBhd2FpdCBpbXBvcnQoJy4vaW5zdHJ1bWVudGF0aW9uLm5vZGUnKTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIC8vIEJhY2tncm91bmQgd29ya2VycyBtdXN0IG5ldmVyIHByZXZlbnQgdGhlIEhUVFAgc2VydmVyIGZyb20gYmVjb21pbmcgbGl2ZS5cclxuICAgICAgY29uc29sZS53YXJuKFxyXG4gICAgICAgICdbaW5zdHJ1bWVudGF0aW9uXSBvcHRpb25hbCBOb2RlIGJvb3RzdHJhcCBmYWlsZWQ7IEhUVFAgc3RhcnR1cCBjb250aW51ZXM6JyxcclxuICAgICAgICBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IGVycm9yLFxyXG4gICAgICApO1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG4iXSwibmFtZXMiOlsicmVnaXN0ZXIiLCJwcm9jZXNzIiwiZW52IiwiTkVYVF9QVUJMSUNfTU9CSUxFX0JVSUxEIiwiTkVYVF9SVU5USU1FIiwiZXJyb3IiLCJjb25zb2xlIiwid2FybiIsIkVycm9yIiwibWVzc2FnZSJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(instrument)/./instrumentation.ts\n");

/***/ }),

/***/ "assert":
/*!*************************!*\
  !*** external "assert" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("assert");

/***/ }),

/***/ "crypto":
/*!*************************!*\
  !*** external "crypto" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("crypto");

/***/ }),

/***/ "events":
/*!*************************!*\
  !*** external "events" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("events");

/***/ }),

/***/ "fs":
/*!*********************!*\
  !*** external "fs" ***!
  \*********************/
/***/ ((module) => {

module.exports = require("fs");

/***/ }),

/***/ "http":
/*!***********************!*\
  !*** external "http" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("http");

/***/ }),

/***/ "http2":
/*!************************!*\
  !*** external "http2" ***!
  \************************/
/***/ ((module) => {

module.exports = require("http2");

/***/ }),

/***/ "https":
/*!************************!*\
  !*** external "https" ***!
  \************************/
/***/ ((module) => {

module.exports = require("https");

/***/ }),

/***/ "os":
/*!*********************!*\
  !*** external "os" ***!
  \*********************/
/***/ ((module) => {

module.exports = require("os");

/***/ }),

/***/ "path":
/*!***********************!*\
  !*** external "path" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("path");

/***/ }),

/***/ "pg":
/*!*********************!*\
  !*** external "pg" ***!
  \*********************/
/***/ ((module) => {

module.exports = import("pg");;

/***/ }),

/***/ "stream":
/*!*************************!*\
  !*** external "stream" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("stream");

/***/ }),

/***/ "swisseph-v2":
/*!******************************!*\
  !*** external "swisseph-v2" ***!
  \******************************/
/***/ ((module) => {

module.exports = require("swisseph-v2");

/***/ }),

/***/ "tty":
/*!**********************!*\
  !*** external "tty" ***!
  \**********************/
/***/ ((module) => {

module.exports = require("tty");

/***/ }),

/***/ "tz-lookup":
/*!****************************!*\
  !*** external "tz-lookup" ***!
  \****************************/
/***/ ((module) => {

module.exports = require("tz-lookup");

/***/ }),

/***/ "url":
/*!**********************!*\
  !*** external "url" ***!
  \**********************/
/***/ ((module) => {

module.exports = require("url");

/***/ }),

/***/ "util":
/*!***********************!*\
  !*** external "util" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("util");

/***/ }),

/***/ "zlib":
/*!***********************!*\
  !*** external "zlib" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("zlib");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("./webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = (__webpack_exec__("(instrument)/./instrumentation.ts"));
module.exports = __webpack_exports__;

})();