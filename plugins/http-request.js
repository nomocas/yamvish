var requesters = {
	text: {
		get: function(url, opt) {
			opt = opt || {};
			return new Promise(function(resolve, reject) {
				var xhr = new XMLHttpRequest();
				xhr.open("GET", url, true);
				xhr.onload = function(e) {
					if (xhr.readyState === 4) {
						if (xhr.status >= 200 && xhr.status < 300)
							resolve(opt.parser ? opt.parser(xhr.responseText) : xhr.responseText);
						else
							reject(xhr.statusText);
					}
				};
				xhr.onerror = function(e) {
					reject(xhr.statusText);
				};
				xhr.send(null);
			});
		}
	},
	json: {
		get: function(url, opt) {
			opt = opt || {};
			opt.parser = function(input) {
				return JSON.parse(input);
			};
			return requesters.text.get(url, opt);
		}
	}
};

module.exports = requesters;
