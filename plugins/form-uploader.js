  module.exports = (function() {
  	"use strict";

  	/*\
  	|*|
  	|*|  :: XMLHttpRequest.prototype.sendAsBinary() Polyfill ::
  	|*|
  	|*|  https://developer.mozilla.org/en-US/docs/DOM/XMLHttpRequest#sendAsBinary()
  	\*/

  	if (!XMLHttpRequest.prototype.sendAsBinary) {
  		XMLHttpRequest.prototype.sendAsBinary = function(sData) {
  			var nBytes = sData.length,
  				ui8Data = new Uint8Array(nBytes);
  			for (var nIdx = 0; nIdx < nBytes; nIdx++) {
  				ui8Data[nIdx] = sData.charCodeAt(nIdx) & 0xff;
  			}
  			/* send as ArrayBufferView...: */
  			this.send(ui8Data);
  			/* ...or as ArrayBuffer (legacy)...: this.send(ui8Data.buffer); */
  		};
  	}

  	/*\
  	|*|
  	|*|  :: AJAX Form Submit Framework ::
  	|*|
  	|*|  https://developer.mozilla.org/en-US/docs/DOM/XMLHttpRequest/Using_XMLHttpRequest
  	|*|
  	|*|  This framework is released under the GNU Public License, version 3 or later.
  	|*|  http://www.gnu.org/licenses/gpl-3.0-standalone.html
  	|*|
  	|*|  Syntax:
  	|*|
  	|*|   AJAXSubmit(HTMLFormElement);
  	\*/

  	function submitData(oData, headers, callback) {
  		/* the AJAX request... */
  		var oAjaxReq = new XMLHttpRequest();
  		oAjaxReq.submittedData = oData;
  		oAjaxReq.onload = callback;

  		if (oData.technique === 0) {
  			/* method is GET */
  			oAjaxReq.open("get", oData.receiver.replace(/(?:\?.*)?$/, oData.segments.length > 0 ? "?" + oData.segments.join("&") : ""), true);
  			setHeaders(oAjaxReq, headers);
  			oAjaxReq.send(null);
  		} else {
  			/* method is POST */
  			oAjaxReq.open("post", oData.receiver, true);
  			setHeaders(oAjaxReq, headers);
  			if (oData.technique === 3) {
  				/* enctype is multipart/form-data */
  				var sBoundary = "---------------------------" + Date.now().toString(16);
  				oAjaxReq.setRequestHeader("Content-Type", "multipart\/form-data; boundary=" + sBoundary);
  				oAjaxReq.sendAsBinary("--" + sBoundary + "\r\n" + oData.segments.join("--" + sBoundary + "\r\n") + "--" + sBoundary + "--\r\n");
  			} else {
  				/* enctype is application/x-www-form-urlencoded or text/plain */
  				oAjaxReq.setRequestHeader("Content-Type", oData.contentType);
  				oAjaxReq.send(oData.segments.join(oData.technique === 2 ? "\r\n" : "&"));
  			}
  		}
  	}

  	function setHeaders(xhr, headers) {
  		for (var i in headers)
  			xhr.setRequestHeader(i, headers[i]);
  	}

  	function pushSegment(oFREvt) {
  		this.owner.segments[this.segmentIdx] += oFREvt.target.result + "\r\n";
  		this.owner.status--;
  	}

  	function checkProcess(oData, callback) {
  		if (oData.status == 0)
  			return callback();
  		setTimeout(function() {
  			checkProcess(oData, callback);
  		}, 50);
  	}

  	function plainEscape(sText) {
  		/* how should I treat a text/plain form encoding? what characters are not allowed? this is what I suppose...: */
  		/* "4\3\7 - Einstein said E=mc2" ----> "4\\3\\7\ -\ Einstein\ said\ E\=mc2" */
  		return sText.replace(/[\s\=\\]/g, "\\$&");
  	}

  	function FormUploader(oTarget, action, method, headers) {
  		var nFile, sFieldType, oField, oSegmReq, oFile, bIsPost = method === "post";
  		/* console.log("AJAXSubmit - Serializing form..."); */

  		this.headers = headers || {};

  		this.contentType = bIsPost && oTarget.enctype ? oTarget.enctype : "application\/x-www-form-urlencoded";
  		this.technique = bIsPost ? this.contentType === "multipart\/form-data" ? 3 : this.contentType === "text\/plain" ? 2 : 1 : 0;
  		this.receiver = action;
  		this.status = 0;
  		this.segments = [];
  		var fFilter = this.technique === 2 ? plainEscape : escape;
  		for (var nItem = 0; nItem < oTarget.elements.length; nItem++) {
  			oField = oTarget.elements[nItem];
  			if (!oField.hasAttribute("name")) {
  				continue;
  			}
  			sFieldType = oField.nodeName.toUpperCase() === "INPUT" ? oField.getAttribute("type").toUpperCase() : "TEXT";
  			if (sFieldType === "FILE" && oField.files.length > 0) {
  				if (this.technique === 3) {
  					/* enctype is multipart/form-data */
  					for (nFile = 0; nFile < oField.files.length; nFile++) {
  						oFile = oField.files[nFile];
  						oSegmReq = new FileReader();
  						/* (custom properties:) */
  						oSegmReq.segmentIdx = this.segments.length;
  						oSegmReq.owner = this;
  						/* (end of custom properties) */
  						oSegmReq.onload = pushSegment;
  						this.segments.push("Content-Disposition: form-data; name=\"" + oField.name + "\"; filename=\"" + oFile.name + "\"\r\nContent-Type: " + oFile.type + "\r\n\r\n");
  						this.status++;
  						oSegmReq.readAsBinaryString(oFile);
  					}
  				} else {
  					/* enctype is application/x-www-form-urlencoded or text/plain or method is GET: files will not be sent! */
  					for (nFile = 0; nFile < oField.files.length; this.segments.push(fFilter(oField.name) + "=" + fFilter(oField.files[nFile++].name)));
  				}
  			} else if ((sFieldType !== "RADIO" && sFieldType !== "CHECKBOX") || oField.checked) {
  				/* field type is not FILE or is FILE but is empty */
  				this.segments.push(
  					this.technique === 3 ? /* enctype is multipart/form-data */
  					"Content-Disposition: form-data; name=\"" + oField.name + "\"\r\n\r\n" + oField.value + "\r\n" : /* enctype is application/x-www-form-urlencoded or text/plain or method is GET */
  					fFilter(oField.name) + "=" + fFilter(oField.value)
  				);
  			}
  		}
  	}

  	FormUploader.prototype = {
  		send: function() {
  			var self = this;
  			return new Promise(function(resolve, reject) {
  				var callback = function() {
  					if (this.status < 300)
  						resolve(JSON.parse(this.responseText));
  					else if (this.status < 400)
  						reject(new Error("redirection not managed (%s) : " + this.responseText, this.status));
  					else
  						reject(new Error("upload failed (%s) : " + this.responseText, this.status));
  				};

  				checkProcess(self, function() {
  					submitData(self, self.headers, callback);
  				});
  			});
  		}
  	};

  	return function(oFormElement, action, method, headers) {
  		action = action || oFormElement.action;
  		if (!action)
  			return Promise.reject(new Error("form upload need action."));
  		return new FormUploader(oFormElement, action, method || 'post', headers).send();
  	};

  })();
