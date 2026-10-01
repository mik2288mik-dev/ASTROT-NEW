// runtime can't be in strict mode because a global variable is assign and maybe created.
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(self["webpackChunk_N_E"] = self["webpackChunk_N_E"] || []).push([["instrumentation"],{

/***/ "(instrument)/./instrumentation.ts":
/*!****************************!*\
  !*** ./instrumentation.ts ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   register: () => (/* binding */ register)\n/* harmony export */ });\n/**\r\n * Next.js instrumentation entrypoint.\r\n * Runtime-specific Node code lives in instrumentation.node.ts so Edge builds never trace\r\n * pg, crypto, path or the native Swiss Ephemeris addon.\r\n */ async function register() {\n    if (process.env.NEXT_PUBLIC_MOBILE_BUILD === '1') return;\n    if (false) {}\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKGluc3RydW1lbnQpLy4vaW5zdHJ1bWVudGF0aW9uLnRzIiwibWFwcGluZ3MiOiI7Ozs7QUFBQTs7OztDQUlDLEdBQ00sZUFBZUE7SUFDcEIsSUFBSUMsUUFBUUMsR0FBRyxDQUFDQyx3QkFBd0IsS0FBSyxLQUFLO0lBQ2xELElBQUlGLEtBQXFDLEVBQUUsRUFVMUM7QUFDSCIsInNvdXJjZXMiOlsiQzpcXFVzZXJzXFx1c2VyXFxsdW1pYVxcQVNUUk9ULU5FV1xcaW5zdHJ1bWVudGF0aW9uLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBOZXh0LmpzIGluc3RydW1lbnRhdGlvbiBlbnRyeXBvaW50LlxyXG4gKiBSdW50aW1lLXNwZWNpZmljIE5vZGUgY29kZSBsaXZlcyBpbiBpbnN0cnVtZW50YXRpb24ubm9kZS50cyBzbyBFZGdlIGJ1aWxkcyBuZXZlciB0cmFjZVxyXG4gKiBwZywgY3J5cHRvLCBwYXRoIG9yIHRoZSBuYXRpdmUgU3dpc3MgRXBoZW1lcmlzIGFkZG9uLlxyXG4gKi9cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlZ2lzdGVyKCkge1xyXG4gIGlmIChwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19NT0JJTEVfQlVJTEQgPT09ICcxJykgcmV0dXJuO1xyXG4gIGlmIChwcm9jZXNzLmVudi5ORVhUX1JVTlRJTUUgPT09ICdub2RlanMnKSB7XHJcbiAgICB0cnkge1xyXG4gICAgICBhd2FpdCBpbXBvcnQoJy4vaW5zdHJ1bWVudGF0aW9uLm5vZGUnKTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIC8vIEJhY2tncm91bmQgd29ya2VycyBtdXN0IG5ldmVyIHByZXZlbnQgdGhlIEhUVFAgc2VydmVyIGZyb20gYmVjb21pbmcgbGl2ZS5cclxuICAgICAgY29uc29sZS53YXJuKFxyXG4gICAgICAgICdbaW5zdHJ1bWVudGF0aW9uXSBvcHRpb25hbCBOb2RlIGJvb3RzdHJhcCBmYWlsZWQ7IEhUVFAgc3RhcnR1cCBjb250aW51ZXM6JyxcclxuICAgICAgICBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IGVycm9yLFxyXG4gICAgICApO1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG4iXSwibmFtZXMiOlsicmVnaXN0ZXIiLCJwcm9jZXNzIiwiZW52IiwiTkVYVF9QVUJMSUNfTU9CSUxFX0JVSUxEIiwiTkVYVF9SVU5USU1FIiwiZXJyb3IiLCJjb25zb2xlIiwid2FybiIsIkVycm9yIiwibWVzc2FnZSJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(instrument)/./instrumentation.ts\n");

/***/ })

},
/******/ __webpack_require__ => { // webpackRuntimeModules
/******/ var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
/******/ var __webpack_exports__ = (__webpack_exec__("(instrument)/./instrumentation.ts"));
/******/ (_ENTRIES = typeof _ENTRIES === "undefined" ? {} : _ENTRIES).middleware_instrumentation = __webpack_exports__;
/******/ }
]);