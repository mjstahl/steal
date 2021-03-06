(function(global){

	// helpers
	var camelize = function(str){
		return str.replace(/-+(.)?/g, function(match, chr){
			return chr ? chr.toUpperCase() : ''
		});
	},
		each = function( o, cb){
			var i, len;

			// weak array detection, but we only use this internally so don't
			// pass it weird stuff
			if ( typeof o.length == 'number' && (o.length - 1) in o) {
				for ( i = 0, len = o.length; i < len; i++ ) {
					cb.call(o[i], o[i], i, o);
				}
			} else {
				for ( i in o ) {
					if(o.hasOwnProperty(i)){
						cb.call(o[i], o[i], i, o);
					}
				}
			}
			return o;
		},
		map = function(o, cb) {
			var arr = [];
			each(o, function(item, i){
				arr[i] = cb(item, i);
			});
			return arr;
		},
		isString = function(o) {
			return typeof o == "string";
		},
		extend = function(d,s){
			each(s, function(v, p){
				d[p] = v;
			});
			return d;
		},
		dir = function(uri){
			var lastSlash = uri.lastIndexOf("/");
			//if no / slashes, check for \ slashes since it might be a windows path
			if(lastSlash === -1)
				lastSlash = uri.lastIndexOf("\\");
			if(lastSlash !== -1) {
				return uri.substr(0, lastSlash);
			} else {
				return uri;
			}
		},
		last = function(arr){
			return arr[arr.length - 1];
		},
		parseURI = function(url) {
			var m = String(url).replace(/^\s+|\s+$/g, '').match(/^([^:\/?#]+:)?(\/\/(?:[^:@]*(?::[^:@]*)?@)?(([^:\/?#]*)(?::(\d*))?))?([^?#]*)(\?[^#]*)?(#[\s\S]*)?/);
				// authority = '//' + user + ':' + pass '@' + hostname + ':' port
				return (m ? {
				href     : m[0] || '',
				protocol : m[1] || '',
				authority: m[2] || '',
				host     : m[3] || '',
				hostname : m[4] || '',
				port     : m[5] || '',
				pathname : m[6] || '',
				search   : m[7] || '',
				hash     : m[8] || ''
			} : null);
		},
		joinURIs = function(base, href) {
			function removeDotSegments(input) {
				var output = [];
				input.replace(/^(\.\.?(\/|$))+/, '')
					.replace(/\/(\.(\/|$))+/g, '/')
					.replace(/\/\.\.$/, '/../')
					.replace(/\/?[^\/]*/g, function (p) {
						if (p === '/..') {
							output.pop();
						} else {
							output.push(p);
						}
					});
				return output.join('').replace(/^\//, input.charAt(0) === '/' ? '/' : '');
			}

			href = parseURI(href || '');
			base = parseURI(base || '');

			return !href || !base ? null : (href.protocol || base.protocol) +
				(href.protocol || href.authority ? href.authority : base.authority) +
				removeDotSegments(href.protocol || href.authority || href.pathname.charAt(0) === '/' ? href.pathname : (href.pathname ? ((base.authority && !base.pathname ? '/' : '') + base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1) + href.pathname) : base.pathname)) +
					(href.protocol || href.authority || href.pathname ? href.search : (href.search || base.search)) +
					href.hash;
		},
		relativeURI = function(base, path) {
			var uriParts = path.split("/"),
				baseParts = base.split("/"),
				result = [];
			while ( uriParts.length && baseParts.length && uriParts[0] == baseParts[0] ) {
				uriParts.shift();
				baseParts.shift();
			}
			for(var i = 0 ; i< baseParts.length-1; i++) {
				result.push("../");
			}
			return "./" + result.join("") + uriParts.join("/");
		},
		fBind = Function.prototype.bind,
		isFunction = function(obj) {
			return !!(obj && obj.constructor && obj.call && obj.apply);
		},
		isWebWorker = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope,
		isNode = typeof process === "object" && {}.toString.call(process) === "[object process]",
		isBrowserWithWindow = !isNode && typeof window !== "undefined",
		isNW = isNode && (function(){
			try {
				return require("nw.gui") !== "undefined";
			} catch(e) {
				return false;
			}
		})(),
		isElectron = isNode && !!process.versions["electron"],
		isNode = isNode && !isNW && !isElectron,
		warn = typeof console === "object" ?
			fBind.call(console.warn, console) : function(){};

	var filename = function(uri){
		var lastSlash = uri.lastIndexOf("/");
		//if no / slashes, check for \ slashes since it might be a windows path
		if(lastSlash === -1)
			lastSlash = uri.lastIndexOf("\\");
		var matches = ( lastSlash == -1 ? uri : uri.substr(lastSlash+1) ).match(/^[\w-\s\.!]+/);
		return matches ? matches[0] : "";
	};
	
	var ext = function(uri){
		var fn = filename(uri);
		var dot = fn.lastIndexOf(".");
		if(dot !== -1) {
			return fn.substr(dot+1);
		} else {
			return "";
		}
	};

	var pluginCache = {};
	
	var normalize = function(name, loader){

		// Detech if this name contains a plugin part like: app.less!steal/less
		// and catch the plugin name so that when it is normalized we do not perform
		// Steal's normalization against it.
		var pluginIndex = name.lastIndexOf('!');
		var pluginPart = "";
		if (pluginIndex != -1) {
			// argumentName is the part before the !
			var argumentName = name.substr(0, pluginIndex);
			var pluginName = name.substr(pluginIndex + 1);
			pluginPart = "!" + pluginName;

			// Set the name to the argument name so that we can normalize it alone.
			name = argumentName;
		} 
		
		var last = filename(name),
			extension = ext(name);
		// if the name ends with /
		if(	name[name.length -1] === "/" ) {
			return name+filename( name.substr(0, name.length-1) ) + pluginPart;
		} else if(	!/^(\w+(?:s)?:\/\/|\.|file|\/)/.test(name) &&
			// and doesn't end with a dot
			 last.indexOf(".") === -1 
			) {
			return name+"/"+last + pluginPart;
		} else {
			if(extension === "js") {
				return name.substr(0, name.lastIndexOf(".")) + pluginPart;
			} else {
				return name + pluginPart;
			}
		}
	};

var cloneSteal = function(System){
	var loader = System || this.System;
	var steal = makeSteal(loader.clone());
	steal.loader.set("@steal", steal.loader.newModule({
		"default": steal,
		__useDefault: true
	}));
	steal.clone = cloneSteal;
	return steal;
};

var makeSteal = function(System){
	var addStealExtension = function (extensionFn) {
		if (typeof System !== "undefined" && isFunction(extensionFn)) {
			if (System._extensions) {
				System._extensions.push(extensionFn);
			}
			extensionFn(System);
		}
	};

	System.set('@loader', System.newModule({
		'default': System,
		__useDefault: true
	}));

	System.config({
		map: {
			"@loader/@loader": "@loader",
			"@steal/@steal": "@steal"
		}
	});

	var configPromise,
		devPromise,
		appPromise;

	var steal = function(){
		var args = arguments;
		var afterConfig = function(){
			var imports = [];
			var factory;
			each(args, function(arg){
				if(isString(arg)) {
					imports.push( steal.System['import']( normalize(arg) ) );
				} else if(typeof arg === "function") {
					factory = arg;
				}
			});

			var modules = Promise.all(imports);
			if(factory) {
				return modules.then(function(modules) {
			        return factory && factory.apply(null, modules);
			   });
			} else {
				return modules;
			}
		};
		if(System.isEnv("production")) {
			return afterConfig();
		} else {
			// wait until the config has loaded
			return configPromise.then(afterConfig,afterConfig);
		}

	};

	System.set("@steal", System.newModule({
		"default": steal,
		__useDefault:true
	}));

	var loaderClone = System.clone;
	System.clone = function(){
		var loader = loaderClone.apply(this, arguments);
		loader.set("@loader", loader.newModule({
			"default": loader,
			__useDefault: true
		}));
		loader.set("@steal", loader.newModule({
			"default": steal,
			__useDefault: true
		}));
		return loader;
	};

	// steal.System remains for backwards compat only
	steal.System = steal.loader = System;
	steal.parseURI = parseURI;
	steal.joinURIs = joinURIs;
	steal.normalize = normalize;
	steal.relativeURI = relativeURI;
	steal.addExtension = addStealExtension;

// System-Ext
// This normalize-hook does 2 things.
// 1. with specify a extension in your config
// 		you can use the "!" (bang) operator to load
// 		that file with the extension
// 		System.ext = {bar: "path/to/bar"}
// 		foo.bar! -> foo.bar!path/to/bar
// 2. if you load a javascript file e.g. require("./foo.js")
// 		normalize will remove the ".js" to load the module
addStealExtension(function (loader) {
  loader.ext = {};

  var normalize = loader.normalize,
    endingExtension = /\.(\w+)!?$/;

  loader.normalize = function (name, parentName, parentAddress, pluginNormalize) {
    if (pluginNormalize) {
      return normalize.apply(this, arguments);
    }

    var matches = name.match(endingExtension);

    if (matches) {
      var hasBang = name[name.length - 1] === "!",
        ext = matches[1];
      // load js-files nodd-like
      if (parentName && loader.configMain !== name && matches[0] === '.js') {
        name = name.substr(0, name.lastIndexOf("."));
        // matches ext mapping
      } else if (loader.ext[ext]) {
        name = name + (hasBang ? "" : "!") + loader.ext[ext];
      }
    }
    return normalize.call(this, name, parentName, parentAddress);
  };
});
// Steal Locate Extension
// normalize a given path e.g.
// "path/to/folder/" -> "path/to/folder/folder"
addStealExtension(function (loader) {
  var normalize = loader.normalize;
  var npmLike = /@.+#.+/;

  loader.normalize = function (name, parentName, parentAddress, pluginNormalize) {
    var lastPos = name.length - 1,
      secondToLast,
      folderName;

    if (name[lastPos] === "/") {
      secondToLast = name.substring(0, lastPos).lastIndexOf("/");
      folderName = name.substring(secondToLast + 1, lastPos);
      if (npmLike.test(folderName)) {
        folderName = folderName.substr(folderName.lastIndexOf("#") + 1);
      }

      name += folderName;
    }
    return normalize.call(this, name, parentName, parentAddress, pluginNormalize);
  };
});
// override loader.translate to rewrite 'locate://' & 'pkg://' path schemes found
// in resources loaded by supporting plugins
addStealExtension(function (loader) {
  /**
   * @hide
   * @function normalizeAndLocate
   * @description Run a module identifier through Normalize and Locate hooks.
   * @param {String} moduleName The module to run through normalize and locate.
   * @return {Promise} A promise to resolve when the address is found.
   */
  var normalizeAndLocate = function(moduleName, parentName){
    var loader = this;
    return Promise.resolve(loader.normalize(moduleName, parentName))
      .then(function(name){
        return loader.locate({name: name, metadata: {}});
      }).then(function(address){
        if(address.substr(address.length - 3) === ".js") {
          address = address.substr(0, address.length - 3);
        }
        return address;
      });
  };

  var relative = function(base, path){
    var uriParts = path.split("/"),
      baseParts = base.split("/"),
      result = [];

    while ( uriParts.length && baseParts.length && uriParts[0] == baseParts[0] ) {
      uriParts.shift();
      baseParts.shift();
    }

    for(var i = 0 ; i< baseParts.length-1; i++) {
      result.push("../");
    }

    return result.join("") + uriParts.join("/");
  };

  var schemePattern = /(locate):\/\/([a-z0-9/._@-]*)/ig,
    parsePathSchemes = function(source, parent) {
      var locations = [];
      source.replace(schemePattern, function(whole, scheme, path, index){
        locations.push({
          start: index,
          end: index+whole.length,
          name: path,
          postLocate: function(address){
            return relative(parent, address);
          }
        });
      });
      return locations;
    };

  var _translate = loader.translate;
  loader.translate = function(load){
    var loader = this;

    // This only applies to plugin resources.
    if(!load.metadata.plugin) {
      return _translate.call(this, load);
    }

    // Use the translator if this file path scheme is supported by the plugin
    var locateSupport = load.metadata.plugin.locateScheme;
    if(!locateSupport) {
      return _translate.call(this, load);
    }

    // Parse array of module names
    var locations = parsePathSchemes(load.source, load.address);

    // no locations found
    if(!locations.length) {
      return _translate.call(this, load);
    }

    // normalize and locate all of the modules found and then replace those instances in the source.
    var promises = [];
    for(var i = 0, len = locations.length; i < len; i++) {
      promises.push(
        normalizeAndLocate.call(this, locations[i].name, load.name)
      );
    }
    return Promise.all(promises).then(function(addresses){
      for(var i = locations.length - 1; i >= 0; i--) {
        load.source = load.source.substr(0, locations[i].start)
          + locations[i].postLocate(addresses[i])
          + load.source.substr(locations[i].end, load.source.length);
      }
      return _translate.call(loader, load);
    });
  };
});
addStealExtension(function (loader) {
  loader._contextualModules = {};

  loader.setContextual = function(moduleName, definer){
    this._contextualModules[moduleName] = definer;
  };

  var normalize = loader.normalize;
  loader.normalize = function(name, parentName){
    var loader = this;

    if (parentName) {
      var definer = this._contextualModules[name];

      // See if `name` is a contextual module
      if (definer) {
        name = name + '/' + parentName;

        if(!loader.has(name)) {
          // `definer` could be a function or could be a moduleName
          if (typeof definer === 'string') {
            definer = loader['import'](definer);
          }

          return Promise.resolve(definer)
            .then(function(definer) {
              if (definer['default']) {
                definer = definer['default'];
              }
              var definePromise = Promise.resolve(
                definer.call(loader, parentName)
              );
              return definePromise;
            })
            .then(function(moduleDef){
              loader.set(name, loader.newModule(moduleDef));
              return name;
            });
        }
        return Promise.resolve(name);
      }
    }

    return normalize.apply(this, arguments);
  };
});
// Steam Script-Module Extension
// Add a steal-module script to the page and it will run after Steal has been configured
// <script type="text/steal-module">...</script>
addStealExtension(function (loader) {
	// stolen from https://github.com/ModuleLoader/es6-module-loader/blob/master/src/module-tag.js
  function completed() {
    document.removeEventListener( "DOMContentLoaded", completed, false );
    window.removeEventListener( "load", completed, false );
    ready();
  }

  function ready() {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var script = scripts[i];
      if (script.type == 'text/steal-module') {
        var source = script.innerHTML;
        if(/\S/.test(source)){
          loader.module(source)['catch'](function(err) { setTimeout(function() { throw err; }); });
        }
      }
    }
  }

  loader.loadScriptModules = function(){
    if(isBrowserWithWindow) {
      if (document.readyState === 'complete') {
        setTimeout(ready);
      } else if (document.addEventListener) {
        document.addEventListener('DOMContentLoaded', completed, false);
        window.addEventListener('load', completed, false);
      }
    }

  };
});
// SystemJS Steal Format
// Provides the Steal module format definition.
addStealExtension(function (loader) {
  // Steal Module Format Detection RegEx
  // steal(module, ...)
  var stealRegEx = /(?:^\s*|[}{\(\);,\n\?\&]\s*)steal\s*\(\s*((?:"[^"]+"\s*,|'[^']+'\s*,\s*)*)/;

  // What we stole.
  var stealInstantiateResult;

  function createSteal(loader) {
    stealInstantiateResult = null;

    // ensure no NodeJS environment detection
    loader.global.module = undefined;
    loader.global.exports = undefined;

    function steal() {
      var deps = [];
      var factory;

      for( var i = 0; i < arguments.length; i++ ) {
        if (typeof arguments[i] === 'string') {
          deps.push( normalize(arguments[i]) );
        } else {
          factory = arguments[i];
        }
      }

      if (typeof factory !== 'function') {
        factory = (function(factory) {
          return function() { return factory; };
        })(factory);
      }

      stealInstantiateResult = {
        deps: deps,
        execute: function(require, exports, moduleName) {

          var depValues = [];
          for (var i = 0; i < deps.length; i++) {
            depValues.push(require(deps[i]));
          }

          var output = factory.apply(loader.global, depValues);

          if (typeof output !== 'undefined') {
            return output;
          }
        }
      };
    }

    loader.global.steal = steal;
  }

  var loaderInstantiate = loader.instantiate;
  loader.instantiate = function(load) {
    var loader = this;

    if (load.metadata.format === 'steal' || !load.metadata.format && load.source.match(stealRegEx)) {
      load.metadata.format = 'steal';

      var oldSteal = loader.global.steal;

      createSteal(loader);

      loader.__exec(load);

      loader.global.steal = oldSteal;

      if (!stealInstantiateResult) {
        throw "Steal module " + load.name + " did not call steal";
      }

      if (stealInstantiateResult) {
        load.metadata.deps = load.metadata.deps ? load.metadata.deps.concat(stealInstantiateResult.deps) : stealInstantiateResult.deps;
        load.metadata.execute = stealInstantiateResult.execute;
      }
    }
    return loaderInstantiate.call(loader, load);
  };
});
addStealExtension(function applyTraceExtension(loader) {
	if(loader._extensions) {
		loader._extensions.push(applyTraceExtension);
	}

	loader._traceData = {
		loads: {},
		parentMap: {}
	};

	loader.getDependencies = function(moduleName){
		var load = this.getModuleLoad(moduleName);
		return load ? load.metadata.dependencies : undefined;
	};
	loader.getDependants = function(moduleName){
		var deps = [];
		var pars = this._traceData.parentMap[moduleName] || {};
		eachOf(pars, function(name) { deps.push(name); });
		return deps;
	};
	loader.getModuleLoad = function(moduleName){
		return this._traceData.loads[moduleName];
	};
	loader.getBundles = function(moduleName, visited){
		visited = visited || {};
		visited[moduleName] = true;
		var loader = this;
		var parentMap = loader._traceData.parentMap;
		var parents = parentMap[moduleName];
		if(!parents) return [moduleName];

		var bundles = [];
		eachOf(parents, function(parentName, value){
			if(!visited[parentName])
				bundles = bundles.concat(loader.getBundles(parentName, visited));
		});
		return bundles;
	};
	loader._allowModuleExecution = {};
	loader.allowModuleExecution = function(name){
		var loader = this;
		return loader.normalize(name).then(function(name){
			loader._allowModuleExecution[name] = true;
		});
	};

	function eachOf(obj, callback){
		var name, val;
		for(name in obj) {
			callback(name, obj[name]);
		}
	}

	var normalize = loader.normalize;
	loader.normalize = function(name, parentName){
		var normalizePromise = normalize.apply(this, arguments);

		if(parentName) {
			var parentMap = this._traceData.parentMap;
			return normalizePromise.then(function(name){
				if(!parentMap[name]) {
					parentMap[name] = {};
				}
				parentMap[name][parentName] = true;
				return name;
			});
		}

		return normalizePromise;
	};

	var emptyExecute = function(){
		return loader.newModule({});
	};

	var passThroughModules = {
		traceur: true,
		babel: true
	};
	var isAllowedToExecute = function(load){
		return passThroughModules[load.name] || this._allowModuleExecution[load.name];
	};

	var map = [].map || function(callback){
		var res = [];
		for(var i = 0, len = this.length; i < len; i++) {
			res.push(callback(this[i]));
		}
		return res;
	};

	var esImportDepsExp = /import [\s\S]*?["'](.+)["']/g;
	var esExportDepsExp = /export .+ from ["'](.+)["']/g;
	var commentRegEx = /(?:(?:^|\s)\/\/(.+?)$)|(?:\/\*([\S\s]*?)\*\/)/gm;
	var stringRegEx = /(?:("|')[^\1\\\n\r]*(?:\\.[^\1\\\n\r]*)*\1|`[^`]*`)/g;

	function getESDeps(source) {
		var cleanSource = source.replace(commentRegEx, "");

		esImportDepsExp.lastIndex = commentRegEx.lastIndex =
			esExportDepsExp.lastIndex = stringRegEx.lastIndex = 0;

		var match;
		var deps = [];
		var stringLocations = []; // track string for unminified source

		function inLocation(locations, match) {
		  for (var i = 0; i < locations.length; i++)
			if (locations[i][0] < match.index && locations[i][1] > match.index)
			  return true;
		  return false;
		}

		function addDeps(exp) {
			while (match = exp.exec(cleanSource)) {
			  // ensure we're not within a string location
			  if (!inLocation(stringLocations, match)) {
				var dep = match[1];
				deps.push(dep);
			  }
			}
		}

		if (source.length / source.split('\n').length < 200) {
		  while (match = stringRegEx.exec(cleanSource))
			stringLocations.push([match.index, match.index + match[0].length]);
		}

		addDeps(esImportDepsExp);
		addDeps(esExportDepsExp);

		return deps;
	}

	var instantiate = loader.instantiate;
	loader.instantiate = function(load){
		this._traceData.loads[load.name] = load;
		var loader = this;
		var instantiatePromise = Promise.resolve(instantiate.apply(this, arguments));

		function finalizeResult(result){
			var preventExecution = loader.preventModuleExecution &&
				!isAllowedToExecute.call(loader, load);

			// deps either comes from the instantiate result, or if an
			// es6 module it was found in the transpile hook.
			var deps = result ? result.deps : load.metadata.deps;

			return Promise.all(map.call(deps, function(depName){
				return loader.normalize(depName, load.name);
			})).then(function(dependencies){
				load.metadata.deps = deps;
				load.metadata.dependencies = dependencies;

				if(preventExecution) {
					return {
						deps: deps,
						execute: emptyExecute
					};
				}

				return result;

			});
		}

		return instantiatePromise.then(function(result){
			// This must be es6
			if(!result) {
				var deps = getESDeps(load.source);
				load.metadata.deps = deps;
			}
			return finalizeResult(result);
		});
	};

	var transpile = loader.transpile;
	// Allow transpile to be memoized, but only once
	loader.transpile = function(load){
		var transpiled = load.metadata.transpiledSource;
		if(transpiled) {
			delete load.metadata.transpiledSource;
			return Promise.resolve(transpiled);
		}
		return transpile.apply(this, arguments);
	};

	loader.eachModule = function(cb){
		for (var moduleName in this._loader.modules) {
			cb.call(this, moduleName, this.get(moduleName));
		}
	};
});

// Steal JSON Format
// Provides the JSON module format definition.
addStealExtension(function (loader) {
  var jsonTest = /^[\s\n\r]*[\{\[]/;
  var jsonExt = /\.json$/i;
  var jsExt = /\.js$/i;

  // if someone has a moduleName that is .json, make sure it loads a json file
  // no matter what paths might do
  var loaderLocate = loader.locate;
  loader.locate = function(load){
    return loaderLocate.apply(this, arguments).then(function(address){
      if(jsonExt.test(load.name)) {
        return address.replace(jsExt, "");
      }

      return address;
    });
  };

  var transform = function(loader, load, data){
    var fn = loader.jsonOptions && loader.jsonOptions.transform;
    if(!fn) return data;
    return fn.call(loader, load, data);
  };

  // If we are in a build we should convert to CommonJS instead.
  if(isNode) {
    var loaderTranslate = loader.translate;
    loader.translate = function(load){
      var address = load.metadata.address || load.address;
      if(jsonExt.test(address) && load.name.indexOf('!') === -1) {
        var parsed = parse(load);
        if(parsed) {
          parsed = transform(this, load, parsed);
          return "def" + "ine([], function(){\n" +
            "\treturn " + JSON.stringify(parsed) + "\n});";
        }
      }

      return loaderTranslate.call(this, load);
    };
    return;
  }

  var loaderInstantiate = loader.instantiate;
  loader.instantiate = function(load) {
    var loader = this,
      parsed;

    parsed = parse(load);
    if(parsed) {
      parsed = transform(loader, load, parsed);
      load.metadata.format = 'json';

      load.metadata.execute = function(){
        return parsed;
      };
    }

    return loaderInstantiate.call(loader, load);
  };

  return loader;

  // Attempt to parse a load as json.
  function parse(load){
    if ( (load.metadata.format === 'json' || !load.metadata.format) && jsonTest.test(load.source)  ) {
      try {
        return JSON.parse(load.source);
      } catch(e) {
        warn("Error parsing " + load.address + ":", e);
        return {};
      }
    }

  }
});
// Steal Cache-Bust Extension
// if enabled, Steal Cache-Bust will add a
// cacheKey and cacheVersion to the required file address
addStealExtension(function (loader) {
	var fetch = loader.fetch;

	loader.fetch = function(load) {
		var loader = this;

		if(loader.isEnv("production") && loader.cacheVersion) {
			var cacheVersion = loader.cacheVersion,
				cacheKey = loader.cacheKey || "version",
				cacheKeyVersion = cacheKey + "=" + cacheVersion;

			load.address = load.address + (load.address.indexOf('?') === -1 ? '?' : '&') + cacheKeyVersion;
		}
		return fetch.call(this, load);
	};
});
	// Overwrites System.config with setter hooks
	var setterConfig = function(loader, configOrder, configSpecial){
		var oldConfig = loader.config;

		loader.config =  function(cfg){

			var data = extend({},cfg);
			// check each special
			each(configOrder, function(name){
				var special = configSpecial[name];
				// if there is a setter and a value
				if(special.set && data[name]){
					// call the setter
					var res = special.set.call(loader,data[name], cfg);
					// if the setter returns a value
					if(res !== undefined) {
						// set that on the loader
						loader[name] = res;
					}
					// delete the property b/c setting is done
					delete data[name];
				}
			});
			oldConfig.call(this, data);
		};
	};

	var setIfNotPresent = function(obj, prop, value){
		if(!obj[prop]) {
			obj[prop] = value;
		}
	};

	// steal.js's default configuration values
	System.configMain = "@config";
	System.devBundle = "@empty";
	System.depsBundle = "@empty";
	System.paths[System.configMain] = "stealconfig.js";
	System.env = (isWebWorker ? "worker" : "window") + "-development";
	System.ext = {};
	System.logLevel = 0;
	var cssBundlesNameGlob = "bundles/*.css",
		jsBundlesNameGlob = "bundles/*";
	setIfNotPresent(System.paths,cssBundlesNameGlob, "dist/bundles/*css");
	setIfNotPresent(System.paths,jsBundlesNameGlob, "dist/bundles/*.js");

	var configSetter = function(order){
		return {
			order: order,
			set: function(val){
				var name = filename(val),
					root = dir(val);

				if(!isNode) {
					System.configPath = joinURIs( location.href, val);
				}
				System.configMain = name;
				System.paths[name] = name;
				this.config({ baseURL: (root === val ? "." : root) + "/" });
			}
		}
	},
		valueSetter = function(prop, order) {
			return {
				order: order,
				set: function(val) {
					this[prop] = val;
				}
			}
		},
		booleanSetter = function(prop, order) {
			return {
				order: order,
				set: function(val) {
					this[prop] = !!val;
				}
			}
		},
		fileSetter = function(prop, order) {
			return {
				order: order,
				set: function(val) {
					this[prop] = envPath(val);
				}
			};
		};

	// checks if we're running in node, then prepends the "file:" protocol if we are
	var envPath = function(val) {
		if(isNode && !/^file:/.test(val)) {
			// If relative join with the current working directory
			if(val[0] === "." && (val[1] === "/" ||
								 (val[1] === "." && val[2] === "/"))) {
				val = require("path").join(process.cwd(), val);
			}
			if(!val) return val;

			return "file:" + val;
		}
		return val;
	};

	var setToSystem = function(prop){
		return {
			set: function(val){
				if(typeof val === "object" && typeof steal.System[prop] === "object") {
					this[prop] = extend(this[prop] || {},val || {});
				} else {
					this[prop] = val;
				}
			}
		};
	};

	var pluginPart = function(name) {
		var bang = name.lastIndexOf("!");
		if(bang !== -1) {
			return name.substr(bang+1);
		}
	};

	var pluginResource = function(name){
		var bang = name.lastIndexOf("!");
		if(bang !== -1) {
			return name.substr(0, bang);
		}
	};

	var addProductionBundles = function(){
		// we don't want add the main bundled module if steal is bundled inside!
		if(this.loadBundles && this.main && !this.stealBundled) {
			var main = this.main,
				bundlesDir = this.bundlesName || "bundles/",
				mainBundleName = bundlesDir+main;

			setIfNotPresent(this.meta, mainBundleName, {format:"amd"});

			// If the configMain has a plugin like package.json!npm,
			// plugin has to be defined prior to importing.
			var plugin = pluginPart(System.configMain);
			var bundle = [main, System.configMain];
			if(plugin){
				System.set(plugin, System.newModule({}));
			}
			plugin = pluginPart(main);
			if(plugin) {
				var resource = pluginResource(main);
				bundle.push(plugin);
				bundle.push(resource);

				mainBundleName = bundlesDir+resource.substr(0, resource.indexOf("."));
			}

			this.bundles[mainBundleName] = bundle;
		}
	};

	var setEnvsConfig = function(){
		if(this.envs) {
			var envConfig = this.envs[this.env];
			if(envConfig) {
				this.config(envConfig);
			}
		}
	};

	var setupLiveReload = function(){
		if(this.liveReloadInstalled) {
			var loader = this;
			this["import"]("live-reload", {
				name: "@@steal"
			}).then(function(reload){
				reload(loader.configMain, function(){
					setEnvsConfig.call(loader);
				});
			});
		}
	};

	var specialConfigOrder = [];
	var envsSpecial = { map: true, paths: true, meta: true };
	var specialConfig = {
		instantiated: {
			order: 1,
			set: function(val){
				var loader = this;

				each(val || {}, function(value, name){
					loader.set(name,  loader.newModule(value));
				});
			}
		},
		envs: {
			order: 2,
			set: function(val){
				// envs should be set, deep
				var envs = this.envs;
				if(!envs) envs = this.envs = {};
				each(val, function(cfg, name){
					var env = envs[name];
					if(!env) env = envs[name] = {};

					each(cfg, function(val, name){
						if(envsSpecial[name] && env[name]) {
							extend(env[name], val);
						} else {
							env[name] = val;
						}
					});
				});
			}
		},
		env: {
			order: 3,
			set: function(val){
				this.env = val;

				if(this.isEnv("production")) {
					this.loadBundles = true;
				}
			}
		},
		loadBundles: booleanSetter("loadBundles", 4),
		stealBundled: booleanSetter("stealBundled", 5),
		// System.config does not like being passed arrays.
		bundle: {
			order: 6,
			set: function(val){
				System.bundle = val;
			}
		},
		bundlesPath: {
			order: 7,
			set: function(val){
				this.paths[cssBundlesNameGlob] = val+"/*css";
				this.paths[jsBundlesNameGlob]  = val+"/*.js";
				return val;
			}
		},
		meta: {
			order: 8,
			set: function(cfg){
				var loader = this;
				each(cfg || {}, function(value, name){
					if(typeof value !== "object") {
						return;
					}
					var cur = loader.meta[name];
					if(cur && cur.format === value.format) {
						// Keep the deps, if we have any
						var deps = value.deps;
						extend(value, cur);
						if(deps) {
							value.deps = deps;
						}
					}
				});
				extend(this.meta, cfg);
			}
		},
		configMain: valueSetter("configMain", 9),
		config: configSetter(10),
		configPath: configSetter(11),
		baseURL: fileSetter("baseURL", 12),
		main: valueSetter("main", 13),
		// this gets called with the __dirname steal is in
		// directly called from steal-tools
		stealPath: {
			order: 14,
			set: function(dirname, cfg) {
				dirname = envPath(dirname);
				var parts = dirname.split("/");

				// steal keeps this around to make things easy no matter how you are using it.
				setIfNotPresent(this.paths,"@dev", dirname+"/ext/dev.js");
				setIfNotPresent(this.paths,"npm", dirname+"/ext/npm.js");
				setIfNotPresent(this.paths,"npm-extension", dirname+"/ext/npm-extension.js");
				setIfNotPresent(this.paths,"npm-utils", dirname+"/ext/npm-utils.js");
				setIfNotPresent(this.paths,"npm-crawl", dirname+"/ext/npm-crawl.js");
				setIfNotPresent(this.paths,"npm-load", dirname+"/ext/npm-load.js");
				setIfNotPresent(this.paths,"npm-convert", dirname+"/ext/npm-convert.js");
				setIfNotPresent(this.paths,"semver", dirname+"/ext/semver.js");
				setIfNotPresent(this.paths,"bower", dirname+"/ext/bower.js");
				setIfNotPresent(this.paths,"live-reload", dirname+"/ext/live-reload.js");
				setIfNotPresent(this.paths,"steal-clone", dirname+"/ext/steal-clone.js");
				this.paths["traceur"] = dirname+"/ext/traceur.js";
				this.paths["traceur-runtime"] = dirname+"/ext/traceur-runtime.js";
				this.paths["babel"] = dirname+"/ext/babel.js";
				this.paths["babel-runtime"] = dirname+"/ext/babel-runtime.js";
				setIfNotPresent(this.meta,"traceur",{"exports":"traceur"});

				// steal-clone is contextual so it can override modules using relative paths
				this.setContextual('steal-clone', 'steal-clone');

				if(isNode) {
					if(this.configMain === "@config" && last(parts) === "steal") {
						parts.pop();
						if(last(parts) === "node_modules") {
							this.configMain = "package.json!npm";
							parts.pop();
						}
					}
					if(this.isEnv("production") || this.loadBundles) {
						addProductionBundles.call(this);
					}
				} else {
					// make sure we don't set baseURL if it already set
					if(!cfg.baseURL && !cfg.config && !cfg.configPath) {

						// if we loading steal.js and it is located in node_modules or bower_components
						// we rewrite the baseURL relative to steal.js (one directory up!)
						// we do this because, normaly our app is located as a sibling folder to
						// node_modules or bower_components
						if ( last(parts) === "steal" ) {
							parts.pop();
							var isFromPackage = false;
							if ( last(parts) === cfg.bowerPath || last(parts) === "bower_components" ) {
								System.configMain = "bower.json!bower";
								addProductionBundles.call(this);
								parts.pop();
								isFromPackage = true;
							}
							if (last(parts) === "node_modules") {
								System.configMain = "package.json!npm";
								addProductionBundles.call(this);
								parts.pop();
								isFromPackage = true;
							}
							if(!isFromPackage) {
								parts.push("steal");
							}
						}
						this.config({ baseURL: parts.join("/")+"/"});
					}
				}
				System.stealPath = dirname;
			}
		},
		stealURL: {
			order: 15,
			// http://domain.com/steal/steal.js?moduleName,env&
			set: function(url, cfg)	{
				var urlParts = url.split("?"),
					path = urlParts.shift(),
					paths = path.split("/"),
					lastPart = paths.pop(),
					stealPath = paths.join("/"),
					platform = this.getPlatform() || (isWebWorker ? "worker" : "window");

				System.stealURL = path;

				// if steal is bundled or we are loading steal.production
				// we always are in production environment
				if((this.stealBundled && this.stealBundled === true) ||
					(lastPart.indexOf("steal.production") > -1 && !cfg.env)) {
					this.config({ env: platform+"-production" });
				}

				if(this.isEnv("production") || this.loadBundles) {
					addProductionBundles.call(this);
				}

				specialConfig.stealPath.set.call(this,stealPath, cfg);

			}
		},
		devBundle: {
			order: 16,

			set: function(dirname, cfg) {
				var path = (dirname === true) ? "dev-bundle" : dirname;

				if (path) {
					this.devBundle = path;
				}
			}
		},
		depsBundle: {
			order: 17,

			set: function(dirname, cfg) {
				var path = (dirname === true) ? "dev-bundle" : dirname;

				if (path) {
					this.depsBundle = path;
				}
			}
		}
	};

	/*
	 make a setter order
	 currently:

	 instantiated
	 envs
	 env
	 loadBundles
	 stealBundled
	 bundle
	 bundlesPath
	 meta
	 config
	 configPath
	 baseURL
	 main
	 stealPath
	 stealURL
	 */
	each(specialConfig, function(setter, name){
		if(!setter.order) {
			specialConfigOrder.push(name)
		}else{
			specialConfigOrder.splice(setter.order, 0, name);
		}
	});

	// special setter config
	setterConfig(System, specialConfigOrder, specialConfig);

	steal.config = function(cfg){
		if(typeof cfg === "string") {
			return this.loader[cfg];
		} else {
			this.loader.config(cfg);
		}
	};

// Steal Env Extension
// adds some special environment functions to the loader
addStealExtension(function (loader) {

	loader.getEnv = function(){
		var envParts = (this.env || "").split("-");
		// Fallback to this.env for legacy
		return envParts[1] || this.env;
	};

	loader.getPlatform = function(){
		var envParts = (this.env || "").split("-");
		return envParts.length === 2 ? envParts[0] : undefined;
	};

	loader.isEnv = function(name){
		return this.getEnv() === name;
	};

	loader.isPlatform = function(name){
		return this.getPlatform() === name;
	};
});
	// get config by the URL query
	// like ?main=foo&env=production
	// formally used for Webworkers
	var getQueryOptions = function(url) {
		var queryOptions = {},
			urlRegEx = /Url$/,
			urlParts = url.split("?"),
			path = urlParts.shift(),
			search = urlParts.join("?"),
			searchParts = search.split("&"),
			paths = path.split("/"),
			lastPart = paths.pop(),
			stealPath = paths.join("/");

		if(searchParts.length && searchParts[0].length) {
				var searchPart;
			for(var i =0; i < searchParts.length; i++) {
				searchPart = searchParts[i];
				var paramParts = searchPart.split("=");
				if(paramParts.length > 1) {
					var optionName = camelize(paramParts[0]);
					// make options uniform e.g. baseUrl => baseURL
					optionName = optionName.replace(urlRegEx, "URL")
					queryOptions[optionName] = paramParts.slice(1).join("=");
				}
			}
		}
		return queryOptions;
	};

	// extract the script tag options
	var getScriptOptions = function (script) {
		var scriptOptions = {},
			urlRegEx = /Url$/;

		scriptOptions.stealURL = script.src;

		each(script.attributes, function(attr){
			// get option, remove "data" and camelize
			var optionName =
				camelize( attr.nodeName.indexOf("data-") === 0 ?
					attr.nodeName.replace("data-","") :
					attr.nodeName );
			// make options uniform e.g. baseUrl => baseURL
			optionName = optionName.replace(urlRegEx, "URL")
			scriptOptions[optionName] = (attr.value === "") ? true : attr.value;
		});

		// main source within steals script is deprecated
		// and will be removed in future releases
		var source = script.innerHTML;
		if(/\S/.test(source)){
			scriptOptions.mainSource = source;
		}
		// script config ever wins!
		return extend(getQueryOptions(script.src), scriptOptions);
	};

	// get steal URL
	// if we are in a browser, we need to know which script is steal
	// to extract the script tag options => getScriptOptions()
	var getUrlOptions = function (){
		return new Promise(function(resolve, reject){

			// for Workers get options from steal query
			if (isWebWorker) {
				resolve(extend({
					stealURL: location.href
				}, getQueryOptions(location.href)));
				return;
			} else if(isBrowserWithWindow || isNW || isElectron) {
				// if the browser supports currentScript, use it!
				if (document.currentScript) {
					// get options from script tag and query
					resolve(getScriptOptions(document.currentScript));
					return;
				}
				// assume the last script on the page is the one loading steal.js
				else {
					var scripts = document.scripts;

					if (scripts.length) {
						resolve(getScriptOptions(scripts[scripts.length - 1]));
					}
				}
			} else {
				// or the only option is where steal is.
				resolve({
					stealPath: __dirname
				});
			}
		})
	};

	// configure and startup steal
	// load the main module(s) if everything is configured
	steal.startup = function(config){
		var steal = this;
		var loader = this.loader;
		var configResolve;
		var configReject;

		configPromise = new Promise(function(resolve, reject){
			configResolve = resolve;
			configReject = reject;
		});

		appPromise = getUrlOptions().then(function(urlOptions) {

			if (typeof config === 'object') {
				// the url options are the source of truth
				config = extend(config, urlOptions);
			} else {
				config = urlOptions;
			}

			// set the config
			loader.config(config);

			setEnvsConfig.call(loader);

			// we only load things with force = true
			if (loader.loadBundles) {

				if (!loader.main && loader.isEnv("production") &&
					!loader.stealBundled) {
					// prevent this warning from being removed by Uglify
					warn("Attribute 'main' is required in production environment. Please add it to the script tag.");
				}

				loader["import"](loader.configMain)
				.then(configResolve, configReject);

				return configPromise.then(function (cfg) {
					setEnvsConfig.call(loader);
					return loader.main ? loader["import"](loader.main) : cfg;
				});

			} else {
				// devBundle includes the same modules as "depsBundle and it also
				// includes the @config graph, so it should be loaded before of
				// configMain
				loader["import"](loader.devBundle)
					.then(function() {
						return loader["import"](loader.configMain);
					})
					.then(function() {
						// depsBundle includes the dependencies in the node_modules
						// folder so it has to be loaded after configMain finished
						// loading
						return loader["import"](loader.depsBundle);
					})
					.then(configResolve, configReject);

				devPromise = configPromise.then(function () {
					setEnvsConfig.call(loader);
					setupLiveReload.call(loader);

					// If a configuration was passed to startup we'll use that to overwrite
					// what was loaded in stealconfig.js
					// This means we call it twice, but that's ok
					if (config) {
						loader.config(config);
					}

					return loader["import"]("@dev");
				});

				return devPromise.then(function () {
					// if there's a main, get it, otherwise, we are just loading
					// the config.
					if (!loader.main || loader.localLoader) {
						return configPromise;
					}
					var main = loader.main;
					if (typeof main === "string") {
						main = [main];
					}
					return Promise.all(map(main, function (main) {
						return loader["import"](main);
					}));
				});
			}
		}).then(function(main){
			if(loader.mainSource) {
				return loader.module(loader.mainSource);
			}

			// load script modules they are tagged as
			// text/steal-module
			loader.loadScriptModules();

			return main;
		});

		return appPromise;
	};
	steal.done = function(){
		return appPromise;
	};


	System.setContextual("@node-require", function(name){
		if(isNode) {
			var nodeRequire = require;
			var load = {name: name, metadata: {}};
			return this.locate(load).then(function(address){
				var url = address.replace("file:", "");
				return {
					"default": function(specifier){
						var resolve = nodeRequire("resolve");
						var res = resolve.sync(specifier, {
							basedir: nodeRequire("path").dirname(url)
						});
						return nodeRequire(res);
					},
					__useDefault: true
				};
			});
		} else {
			return {
				"default": function(){},
				__useDefault: true
			}
		}
	});

	steal["import"] = function(){
		var names = arguments;
		var loader = this.System;

		function afterConfig(){
			var imports = [];
			each(names, function(name){
				imports.push(loader["import"](name));
			});
			if(imports.length > 1) {
				return Promise.all(imports);
			} else {
				return imports[0];
			}
		}

		if(!configPromise) {
			// In Node a main isn't required, but we still want
			// to call startup() to do autoconfiguration,
			// so setting to empty allows this to work.
			if(!loader.main) {
				loader.main = "@empty";
			}
			steal.startup();
		}

		return configPromise.then(afterConfig);
	};
	steal.setContextual = fBind.call(System.setContextual, System);
	steal.isEnv = fBind.call(System.isEnv, System);
	steal.isPlatform = fBind.call(System.isPlatform, System);
	return steal;

};
/*
 * StealJS base extension
 *
 * **src/base/base.js** is an autogenerated file; any change should be
 * made to the source files in **src/base/lib/*.js**
 */


(function($__global) {

$__global.upgradeSystemLoader = function() {
  $__global.upgradeSystemLoader = undefined;

  // indexOf polyfill for IE
  var indexOf = Array.prototype.indexOf || function(item) {
    for (var i = 0, l = this.length; i < l; i++)
      if (this[i] === item)
        return i;
    return -1;
  }

  var isWindows = typeof process != 'undefined' && !!process.platform.match(/^win/);

  // Absolute URL parsing, from https://gist.github.com/Yaffle/1088850
  function parseURI(url) {
    var m = String(url).replace(/^\s+|\s+$/g, '').match(/^([^:\/?#]+:)?(\/\/(?:[^:@\/?#]*(?::[^:@\/?#]*)?@)?(([^:\/?#]*)(?::(\d*))?))?([^?#]*)(\?[^#]*)?(#[\s\S]*)?/);
    // authority = '//' + user + ':' + pass '@' + hostname + ':' port
    return (m ? {
      href     : m[0] || '',
      protocol : m[1] || '',
      authority: m[2] || '',
      host     : m[3] || '',
      hostname : m[4] || '',
      port     : m[5] || '',
      pathname : m[6] || '',
      search   : m[7] || '',
      hash     : m[8] || ''
    } : null);
  }
  function toAbsoluteURL(base, href) {
    function removeDotSegments(input) {
      var output = [];
      input.replace(/^(\.\.?(\/|$))+/, '')
        .replace(/\/(\.(\/|$))+/g, '/')
        .replace(/\/\.\.$/, '/../')
        .replace(/\/?[^\/]*/g, function (p) {
          if (p === '/..')
            output.pop();
          else
            output.push(p);
      });
      return output.join('').replace(/^\//, input.charAt(0) === '/' ? '/' : '');
    }

    if (isWindows)
      href = href.replace(/\\/g, '/');

    href = parseURI(href || '');
    base = parseURI(base || '');

    return !href || !base ? null : (href.protocol || base.protocol) +
      (href.protocol || href.authority ? href.authority : base.authority) +
      removeDotSegments(href.protocol || href.authority || href.pathname.charAt(0) === '/' ? href.pathname : (href.pathname ? ((base.authority && !base.pathname ? '/' : '') + base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1) + href.pathname) : base.pathname)) +
      (href.protocol || href.authority || href.pathname ? href.search : (href.search || base.search)) +
      href.hash;
  }

  // clone the original System loader
  var System;
  (function() {
    var originalSystem = $__global.System;
    System = $__global.System = new LoaderPolyfill(originalSystem);
    System.baseURL = originalSystem.baseURL;
    System.paths = { '*': '*.js' };
    System.originalSystem = originalSystem;
  })();

  System.noConflict = function() {
    $__global.SystemJS = System;
    $__global.System = System.originalSystem;
  }

  

var getOwnPropertyDescriptor = true;
try {
  Object.getOwnPropertyDescriptor({ a: 0 }, 'a');
}
catch(e) {
  getOwnPropertyDescriptor = false;
}

var defineProperty;
(function () {
  try {
    if (!!Object.defineProperty({}, 'a', {}))
      defineProperty = Object.defineProperty;
  }
  catch (e) {
    defineProperty = function(obj, prop, opt) {
      try {
        obj[prop] = opt.value || opt.get.call(obj);
      }
      catch(e) {}
    }
  }
})();

// converts any module.exports object into an object ready for SystemJS.newModule
function getESModule(exports) {
  var esModule = {};
  // don't trigger getters/setters in environments that support them
  if ((typeof exports == 'object' || typeof exports == 'function') && exports !== $__global) {
      if (getOwnPropertyDescriptor) {
        for (var p in exports) {
          // The default property is copied to esModule later on
          if (p === 'default')
            continue;
          defineOrCopyProperty(esModule, exports, p);
        }
      }
      else {
        extend(esModule, exports);
      }
  }
  esModule['default'] = exports;
  defineProperty(esModule, '__useDefault', {
    value: true
  });
  return esModule;
}

function defineOrCopyProperty(targetObj, sourceObj, propName) {
  try {
    var d;
    if (d = Object.getOwnPropertyDescriptor(sourceObj, propName))
      defineProperty(targetObj, propName, d);
  }
  catch (ex) {
    // Object.getOwnPropertyDescriptor threw an exception, fall back to normal set property
    // we dont need hasOwnProperty here because getOwnPropertyDescriptor would have returned undefined above
    targetObj[propName] = sourceObj[propName];
    return false;
  }
}

function extend(a, b, prepend) {
  var hasOwnProperty = b && b.hasOwnProperty;
  for (var p in b) {
    if (hasOwnProperty && !b.hasOwnProperty(p))
      continue;
    if (!prepend || !(p in a))
      a[p] = b[p];
  }
  return a;
}

/*
 * SystemJS Core
 * Code should be vaguely readable
 * 
 */
var originalSystem = $__global.System.originalSystem;
function core(loader) {
  /*
    __useDefault
    
    When a module object looks like:
    newModule(
      __useDefault: true,
      default: 'some-module'
    })

    Then importing that module provides the 'some-module'
    result directly instead of the full module.

    Useful for eg module.exports = function() {}
  */
  var loaderImport = loader['import'];
  loader['import'] = function(name, options) {
    return loaderImport.call(this, name, options).then(function(module) {
      return module.__useDefault ? module['default'] : module;
    });
  };

  // support the empty module, as a concept
  loader.set('@empty', loader.newModule({}));

  // include the node require since we're overriding it
  if (typeof require != 'undefined')
    loader._nodeRequire = require;

  /*
    Config
    Extends config merging one deep only

    loader.config({
      some: 'random',
      config: 'here',
      deep: {
        config: { too: 'too' }
      }
    });

    <=>

    loader.some = 'random';
    loader.config = 'here'
    loader.deep = loader.deep || {};
    loader.deep.config = { too: 'too' };
  */
  loader.config = function(cfg) {
    for (var c in cfg) {
      var v = cfg[c];
      if (typeof v == 'object' && !(v instanceof Array)) {
        this[c] = this[c] || {};
        for (var p in v)
          this[c][p] = v[p];
      }
      else
        this[c] = v;
    }
  };

  // override locate to allow baseURL to be document-relative
  var baseURI;
  if (typeof window == 'undefined' &&
      typeof WorkerGlobalScope == 'undefined') {
    baseURI = 'file:' + process.cwd() + '/';
    if (isWindows)
      baseURI = baseURI.replace(/\\/g, '/');
  }
  // Inside of a Web Worker
  else if(typeof window == 'undefined') {
    baseURI = loader.global.location.href;
  }
  else {
    baseURI = document.baseURI;
    if (!baseURI) {
      var bases = document.getElementsByTagName('base');
      baseURI = bases[0] && bases[0].href || window.location.href;
    }
  }

  var loaderLocate = loader.locate;
  var normalizedBaseURL;
  loader.locate = function(load) {
    if (this.baseURL != normalizedBaseURL) {
      normalizedBaseURL = toAbsoluteURL(baseURI, this.baseURL);

      if (normalizedBaseURL.substr(normalizedBaseURL.length - 1, 1) != '/')
        normalizedBaseURL += '/';
      this.baseURL = normalizedBaseURL;
    }

    return Promise.resolve(loaderLocate.call(this, load));
  };

  function applyExtensions(extensions, loader) {
    loader._extensions = [];
    for(var i = 0, len = extensions.length; i < len; i++) {
      extensions[i](loader);
    }
  }

  loader._extensions = loader._extensions || [];
  loader._extensions.push(core);

  loader.clone = function() {
    var originalLoader = this;
    var loader = new LoaderPolyfill(originalSystem);
    loader.baseURL = originalLoader.baseURL;
    loader.paths = { '*': '*.js' };
    applyExtensions(originalLoader._extensions, loader);
    return loader;
  };
}

/*
 * Meta Extension
 *
 * Sets default metadata on a load record (load.metadata) from
 * loader.meta[moduleName].
 * Also provides an inline meta syntax for module meta in source.
 *
 * Eg:
 *
 * loader.meta['my/module'] = { some: 'meta' };
 *
 * load.metadata.some = 'meta' will now be set on the load record.
 *
 * The same meta could be set with a my/module.js file containing:
 * 
 * my/module.js
 *   "some meta"; 
 *   "another meta";
 *   console.log('this is my/module');
 *
 * The benefit of inline meta is that coniguration doesn't need
 * to be known in advance, which is useful for modularising
 * configuration and avoiding the need for configuration injection.
 *
 *
 * Example
 * -------
 *
 * The simplest meta example is setting the module format:
 *
 * System.meta['my/module'] = { format: 'amd' };
 *
 * or inside 'my/module.js':
 *
 * "format amd";
 * define(...);
 * 
 */

function meta(loader) {
  var metaRegEx = /^(\s*\/\*.*\*\/|\s*\/\/[^\n]*|\s*"[^"]+"\s*;?|\s*'[^']+'\s*;?)+/;
  var metaPartRegEx = /\/\*.*\*\/|\/\/[^\n]*|"[^"]+"\s*;?|'[^']+'\s*;?/g;

  loader.meta = {};
  loader._extensions = loader._extensions || [];
  loader._extensions.push(meta);

  function setConfigMeta(loader, load) {
    var meta = loader.meta && loader.meta[load.name];
    if (meta) {
      for (var p in meta)
        load.metadata[p] = load.metadata[p] || meta[p];
    }
  }

  var loaderLocate = loader.locate;
  loader.locate = function(load) {
    setConfigMeta(this, load);
    return loaderLocate.call(this, load);
  }

  var loaderTranslate = loader.translate;
  loader.translate = function(load) {
    // detect any meta header syntax
    var meta = load.source.match(metaRegEx);
    if (meta) {
      var metaParts = meta[0].match(metaPartRegEx);
      for (var i = 0; i < metaParts.length; i++) {
        var len = metaParts[i].length;

        var firstChar = metaParts[i].substr(0, 1);
        if (metaParts[i].substr(len - 1, 1) == ';')
          len--;
      
        if (firstChar != '"' && firstChar != "'")
          continue;

        var metaString = metaParts[i].substr(1, metaParts[i].length - 3);

        var metaName = metaString.substr(0, metaString.indexOf(' '));
        if (metaName) {
          var metaValue = metaString.substr(metaName.length + 1, metaString.length - metaName.length - 1);

          if (load.metadata[metaName] instanceof Array)
            load.metadata[metaName].push(metaValue);
          else if (!load.metadata[metaName])
            load.metadata[metaName] = metaValue;
        }
      }
    }
    // config meta overrides
    setConfigMeta(this, load);
    
    return loaderTranslate.call(this, load);
  }
}

/*
 * Instantiate registry extension
 *
 * Supports Traceur System.register 'instantiate' output for loading ES6 as ES5.
 *
 * - Creates the loader.register function
 * - Also supports metadata.format = 'register' in instantiate for anonymous register modules
 * - Also supports metadata.deps, metadata.execute and metadata.executingRequire
 *     for handling dynamic modules alongside register-transformed ES6 modules
 *
 * Works as a standalone extension, but benefits from having a more
 * advanced __eval defined like in SystemJS polyfill-wrapper-end.js
 *
 * The code here replicates the ES6 linking groups algorithm to ensure that
 * circular ES6 compiled into System.register can work alongside circular AMD
 * and CommonJS, identically to the actual ES6 loader.
 *
 */
function register(loader) {
  if (typeof indexOf == 'undefined')
    indexOf = Array.prototype.indexOf;
  if (typeof __eval == 'undefined' || typeof document != 'undefined' && !document.addEventListener)
    __eval = 0 || eval; // uglify breaks without the 0 ||

  loader._extensions = loader._extensions || [];
  loader._extensions.push(register);

  // define exec for easy evaluation of a load record (load.name, load.source, load.address)
  // main feature is source maps support handling
  var curSystem;
  function exec(load, context) {
    var loader = this;
    // support sourceMappingURL (efficiently)
    var sourceMappingURL;
    var lastLineIndex = load.source.lastIndexOf('\n');
    if (lastLineIndex != -1) {
      if (load.source.substr(lastLineIndex + 1, 21) == '//# sourceMappingURL=') {
        sourceMappingURL = load.source.substr(lastLineIndex + 22, load.source.length - lastLineIndex - 22);
        if (typeof toAbsoluteURL != 'undefined')
          sourceMappingURL = toAbsoluteURL(load.address, sourceMappingURL);
      }
    }

    var evalType = load.metadata && load.metadata.eval;
    context = context || loader.global;
    __eval(load.source, load.address, context, sourceMappingURL, evalType);
  }
  loader.__exec = exec;

  function dedupe(deps) {
    var newDeps = [];
    for (var i = 0, l = deps.length; i < l; i++)
      if (indexOf.call(newDeps, deps[i]) == -1)
        newDeps.push(deps[i])
    return newDeps;
  }

  /*
   * There are two variations of System.register:
   * 1. System.register for ES6 conversion (2-3 params) - System.register([name, ]deps, declare)
   *    see https://github.com/ModuleLoader/es6-module-loader/wiki/System.register-Explained
   *
   * 2. System.register for dynamic modules (3-4 params) - System.register([name, ]deps, executingRequire, execute)
   * the true or false statement
   *
   * this extension implements the linking algorithm for the two variations identical to the spec
   * allowing compiled ES6 circular references to work alongside AMD and CJS circular references.
   *
   */
  // loader.register sets loader.defined for declarative modules
  var anonRegister;
  var calledRegister;
  function registerModule(name, deps, declare, execute) {
    if (typeof name != 'string') {
      execute = declare;
      declare = deps;
      deps = name;
      name = null;
    }

    calledRegister = true;

    var register;

    // dynamic
    if (typeof declare == 'boolean') {
      register = {
        declarative: false,
        deps: deps,
        execute: execute,
        executingRequire: declare
      };
    }
    else {
      // ES6 declarative
      register = {
        declarative: true,
        deps: deps,
        declare: declare
      };
    }

    // named register
    if (name) {
      register.name = name;
      // we never overwrite an existing define
      if (!(name in loader.defined))
        loader.defined[name] = register;
    }
    // anonymous register
    else if (register.declarative) {
      if (anonRegister)
        throw new TypeError('Multiple anonymous System.register calls in the same module file.');
      anonRegister = register;
    }
  }
  /*
   * Registry side table - loader.defined
   * Registry Entry Contains:
   *    - name
   *    - deps
   *    - declare for declarative modules
   *    - execute for dynamic modules, different to declarative execute on module
   *    - executingRequire indicates require drives execution for circularity of dynamic modules
   *    - declarative optional boolean indicating which of the above
   *
   * Can preload modules directly on System.defined['my/module'] = { deps, execute, executingRequire }
   *
   * Then the entry gets populated with derived information during processing:
   *    - normalizedDeps derived from deps, created in instantiate
   *    - groupIndex used by group linking algorithm
   *    - evaluated indicating whether evaluation has happend
   *    - module the module record object, containing:
   *      - exports actual module exports
   *
   *    Then for declarative only we track dynamic bindings with the records:
   *      - name
   *      - setters declarative setter functions
   *      - exports actual module values
   *      - dependencies, module records of dependencies
   *      - importers, module records of dependents
   *
   * After linked and evaluated, entries are removed, declarative module records remain in separate
   * module binding table
   *
   */

  function defineRegister(loader) {
    if (loader.register)
      return;

    loader.register = registerModule;

    if (!loader.defined)
      loader.defined = {};

    // script injection mode calls this function synchronously on load
    var onScriptLoad = loader.onScriptLoad;
    loader.onScriptLoad = function(load) {
      onScriptLoad(load);
      // anonymous define
      if (anonRegister)
        load.metadata.entry = anonRegister;

      if (calledRegister) {
        load.metadata.format = load.metadata.format || 'register';
        load.metadata.registered = true;
      }
    }
  }

  defineRegister(loader);

  function buildGroups(entry, loader, groups) {
    groups[entry.groupIndex] = groups[entry.groupIndex] || [];

    if (indexOf.call(groups[entry.groupIndex], entry) != -1)
      return;

    groups[entry.groupIndex].push(entry);

    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      var depEntry = loader.defined[depName];

      // not in the registry means already linked / ES6
      if (!depEntry || depEntry.evaluated)
        continue;

      // now we know the entry is in our unlinked linkage group
      var depGroupIndex = entry.groupIndex + (depEntry.declarative != entry.declarative);

      // the group index of an entry is always the maximum
      if (depEntry.groupIndex === undefined || depEntry.groupIndex < depGroupIndex) {

        // if already in a group, remove from the old group
        if (depEntry.groupIndex !== undefined) {
          groups[depEntry.groupIndex].splice(indexOf.call(groups[depEntry.groupIndex], depEntry), 1);

          // if the old group is empty, then we have a mixed depndency cycle
          if (groups[depEntry.groupIndex].length == 0)
            throw new TypeError("Mixed dependency cycle detected");
        }

        depEntry.groupIndex = depGroupIndex;
      }

      buildGroups(depEntry, loader, groups);
    }
  }

  function link(name, loader) {
    var startEntry = loader.defined[name];

    // skip if already linked
    if (startEntry.module)
      return;

    startEntry.groupIndex = 0;

    var groups = [];

    buildGroups(startEntry, loader, groups);

    var curGroupDeclarative = !!startEntry.declarative == groups.length % 2;
    for (var i = groups.length - 1; i >= 0; i--) {
      var group = groups[i];
      for (var j = 0; j < group.length; j++) {
        var entry = group[j];

        // link each group
        if (curGroupDeclarative)
          linkDeclarativeModule(entry, loader);
        else
          linkDynamicModule(entry, loader);
      }
      curGroupDeclarative = !curGroupDeclarative;
    }
  }

  // module binding records
  var moduleRecords = {};
  function getOrCreateModuleRecord(name) {
    return moduleRecords[name] || (moduleRecords[name] = {
      name: name,
      dependencies: [],
      exports: {}, // start from an empty module and extend
      importers: []
    })
  }

  function linkDeclarativeModule(entry, loader) {
    // only link if already not already started linking (stops at circular)
    if (entry.module)
      return;

    var module = entry.module = getOrCreateModuleRecord(entry.name);
    var exports = entry.module.exports;

    var declaration = entry.declare.call(loader.global, function(name, value) {
      module.locked = true;
      exports[name] = value;

      for (var i = 0, l = module.importers.length; i < l; i++) {
        var importerModule = module.importers[i];
        if (!importerModule.locked) {
          var importerIndex = indexOf.call(importerModule.dependencies, module);
          importerModule.setters[importerIndex](exports);
        }
      }

      module.locked = false;
      return value;
    });

    module.setters = declaration.setters;
    module.execute = declaration.execute;

    if (!module.setters || !module.execute) {
      throw new TypeError('Invalid System.register form for ' + entry.name);
    }

    // now link all the module dependencies
    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      var depEntry = loader.defined[depName];
      var depModule = moduleRecords[depName];

      // work out how to set depExports based on scenarios...
      var depExports;

      if (depModule) {
        depExports = depModule.exports;
      }
      // dynamic, already linked in our registry
      else if (depEntry && !depEntry.declarative) {
        if (depEntry.module.exports && depEntry.module.exports.__esModule)
          depExports = depEntry.module.exports;
        else
          depExports = depEntry.esModule;
          //depExports = { 'default': depEntry.module.exports, '__useDefault': true };
      }
      // in the loader registry
      else if (!depEntry) {
        depExports = loader.get(depName);
      }
      // we have an entry -> link
      else {
        linkDeclarativeModule(depEntry, loader);
        depModule = depEntry.module;
        depExports = depModule.exports;
      }

      // only declarative modules have dynamic bindings
      if (depModule && depModule.importers) {
        depModule.importers.push(module);
        module.dependencies.push(depModule);
      }
      else {
        module.dependencies.push(null);
      }

      // run the setter for this dependency
      if (module.setters[i])
        module.setters[i](depExports);
    }
  }

  // An analog to loader.get covering execution of all three layers (real declarative, simulated declarative, simulated dynamic)
  function getModule(name, loader) {
    var exports;
    var entry = loader.defined[name];

    if (!entry) {
      exports = loader.get(name);
      if (!exports)
        throw new Error('Unable to load dependency ' + name + '.');
    }

    else {
      if (entry.declarative)
        ensureEvaluated(name, [], loader);

      else if (!entry.evaluated)
        linkDynamicModule(entry, loader);

      exports = entry.module.exports;
    }

    if ((!entry || entry.declarative) && exports && exports.__useDefault)
      return exports['default'];

    return exports;
  }

  function linkDynamicModule(entry, loader) {
    if (entry.module)
      return;

    var exports = {};

    var module = entry.module = { exports: exports, id: entry.name };

    // AMD requires execute the tree first
    if (!entry.executingRequire) {
      for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
        var depName = entry.normalizedDeps[i];
        var depEntry = loader.defined[depName];
        if (depEntry)
          linkDynamicModule(depEntry, loader);
      }
    }

    // now execute
    entry.evaluated = true;
    var output = entry.execute.call(loader.global, function(name) {
      for (var i = 0, l = entry.deps.length; i < l; i++) {
        if (entry.deps[i] != name)
          continue;
        return getModule(entry.normalizedDeps[i], loader);
      }
      throw new TypeError('Module ' + name + ' not declared as a dependency.');
    }, exports, module);

    if (output)
      module.exports = output;

    // create the esModule object, which allows ES6 named imports of dynamics
    exports = module.exports;

    // __esModule flag treats as already-named
    if (exports && (exports.__esModule || exports instanceof Module))
      entry.esModule = exports;
    // set module as 'default' export, then fake named exports by iterating properties
    else if (entry.esmExports && exports !== loader.global)
      entry.esModule = getESModule(exports);
    // just use the 'default' export
    else
      entry.esModule = { 'default': exports };
  }

  /*
   * Given a module, and the list of modules for this current branch,
   *  ensure that each of the dependencies of this module is evaluated
   *  (unless one is a circular dependency already in the list of seen
   *  modules, in which case we execute it)
   *
   * Then we evaluate the module itself depth-first left to right
   * execution to match ES6 modules
   */
  function ensureEvaluated(moduleName, seen, loader) {
    var entry = loader.defined[moduleName];

    // if already seen, that means it's an already-evaluated non circular dependency
    if (!entry || entry.evaluated || !entry.declarative)
      return;

    // this only applies to declarative modules which late-execute

    seen.push(moduleName);

    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      if (indexOf.call(seen, depName) == -1) {
        if (!loader.defined[depName])
          loader.get(depName);
        else
          ensureEvaluated(depName, seen, loader);
      }
    }

    if (entry.evaluated)
      return;

    entry.evaluated = true;
    entry.module.execute.call(loader.global);
  }

  var Module = loader.newModule({}).constructor;

  var registerRegEx = /System\.register/;

  var loaderFetch = loader.fetch;
  loader.fetch = function(load) {
    var loader = this;
    defineRegister(loader);
    if (loader.defined[load.name]) {
      load.metadata.format = 'defined';
      return '';
    }
    anonRegister = null;
    calledRegister = false;
    // the above get picked up by onScriptLoad
    return loaderFetch.call(loader, load);
  }

  var loaderTranslate = loader.translate;
  loader.translate = function(load) {
    this.register = registerModule;

    this.__exec = exec;

    load.metadata.deps = load.metadata.deps || [];

    // we run the meta detection here (register is after meta)
    return Promise.resolve(loaderTranslate.call(this, load)).then(function(source) {

      // dont run format detection for globals shimmed
      // ideally this should be in the global extension, but there is
      // currently no neat way to separate it
      if (load.metadata.init || load.metadata.exports)
        load.metadata.format = load.metadata.format || 'global';

      // run detection for register format
      if (load.metadata.format == 'register' || !load.metadata.format && load.source.match(registerRegEx))
        load.metadata.format = 'register';
      return source;
    });
  }


  var loaderInstantiate = loader.instantiate;
  loader.instantiate = function(load) {
    var loader = this;

    var entry;

    // first we check if this module has already been defined in the registry
    if (loader.defined[load.name]) {
      entry = loader.defined[load.name];
      entry.deps = entry.deps.concat(load.metadata.deps);
    }

    // picked up already by a script injection
    else if (load.metadata.entry)
      entry = load.metadata.entry;

    // otherwise check if it is dynamic
    else if (load.metadata.execute) {
      entry = {
        declarative: false,
        deps: load.metadata.deps || [],
        esModule: null,
        execute: load.metadata.execute,
        executingRequire: load.metadata.executingRequire // NodeJS-style requires or not
      };
    }

    // Contains System.register calls
    else if (load.metadata.format == 'register') {
      anonRegister = null;
      calledRegister = false;

      var curSystem = loader.global.System;

      loader.global.System = loader;

      loader.__exec(load);

      loader.global.System = curSystem;

      if (anonRegister)
        entry = anonRegister;

      if (!entry && System.defined[load.name])
        entry = System.defined[load.name];

      if (!calledRegister && !load.metadata.registered)
        throw new TypeError(load.name + ' detected as System.register but didn\'t execute.');
    }

    // named bundles are just an empty module
    if (!entry && load.metadata.format != 'es6')
      return {
        deps: load.metadata.deps,
        execute: function() {
          return loader.newModule({});
        }
      };

    // place this module onto defined for circular references
    if (entry)
      loader.defined[load.name] = entry;

    // no entry -> treat as ES6
    else
      return loaderInstantiate.call(this, load);

    entry.deps = dedupe(entry.deps);
    entry.name = load.name;
    entry.esmExports = load.metadata.esmExports !== false;

    // first, normalize all dependencies
    var normalizePromises = [];
    for (var i = 0, l = entry.deps.length; i < l; i++)
      normalizePromises.push(Promise.resolve(loader.normalize(entry.deps[i], load.name)));

    return Promise.all(normalizePromises).then(function(normalizedDeps) {

      entry.normalizedDeps = normalizedDeps;

      return {
        deps: entry.deps,
        execute: function() {
          // recursively ensure that the module and all its
          // dependencies are linked (with dependency group handling)
          link(load.name, loader);

          // now handle dependency execution in correct order
          ensureEvaluated(load.name, [], loader);

          // remove from the registry
          loader.defined[load.name] = undefined;

          var module = entry.module.exports;

          if(!entry.declarative)
            module = entry.esModule;

          // return the defined module object
          return loader.newModule(module);
        }
      };
    });
  }
}

/*
 * Extension to detect ES6 and auto-load Traceur or Babel for processing
 */
function es6(loader) {
  loader._extensions.push(es6);

  // good enough ES6 detection regex - format detections not designed to be accurate, but to handle the 99% use case
  var es6RegEx = /(^\s*|[}\);\n]\s*)(import\s+(['"]|(\*\s+as\s+)?[^"'\(\)\n;]+\s+from\s+['"]|\{)|export\s+\*\s+from\s+["']|export\s+(\{|default|function|class|var|const|let|async\s+function))/;

  var traceurRuntimeRegEx = /\$traceurRuntime\s*\./;
  var babelHelpersRegEx = /babelHelpers\s*\./;

  var transpilerNormalized, transpilerRuntimeNormalized;

  var firstLoad = true;

  var nodeResolver = typeof process != 'undefined' && typeof require != 'undefined' && require.resolve;

  function setConfig(loader, module, nodeModule) {
    loader.meta[module] = {format: 'global'};
    if (nodeResolver && !loader.paths[module]) {
      try {
        loader.paths[module] = require.resolve(nodeModule || module);
      }
      catch(e) {}
    }
  }

  var loaderLocate = loader.locate;
  loader.locate = function(load) {
    var self = this;
    if (firstLoad) {
      if (self.transpiler == 'traceur') {
        setConfig(self, 'traceur', 'traceur/bin/traceur.js');
        self.meta['traceur'].exports = 'traceur';
        setConfig(self, 'traceur-runtime', 'traceur/bin/traceur-runtime.js');
      }
      else if (self.transpiler == 'babel') {
        setConfig(self, 'babel', 'babel-core/browser.js');
        setConfig(self, 'babel-runtime', 'babel-core/external-helpers.js');
      }
      firstLoad = false;
    }
    return loaderLocate.call(self, load);
  };

  var loaderTranslate = loader.translate;
  loader.translate = function(load) {
    var loader = this;

    return loaderTranslate.call(loader, load)
    .then(function(source) {

      // detect ES6
      if (load.metadata.format == 'es6' || !load.metadata.format && source.match(es6RegEx)) {
        load.metadata.format = 'es6';
        return source;
      }

      if (load.metadata.format == 'register') {
        if (!loader.global.$traceurRuntime && load.source.match(traceurRuntimeRegEx)) {
          return loader['import']('traceur-runtime').then(function() {
            return source;
          });
        }
        if (!loader.global.babelHelpers && load.source.match(babelHelpersRegEx)) {
          return loader['import']('babel/external-helpers').then(function() {
            return source;
          });
        }
      }

      // ensure Traceur doesn't clobber the System global
      if (loader.transpiler == 'traceur')
        return Promise.all([
          transpilerNormalized || (transpilerNormalized = loader.normalize(loader.transpiler)),
          transpilerRuntimeNormalized || (transpilerRuntimeNormalized = loader.normalize(loader.transpiler + '-runtime'))
        ])
        .then(function(normalized) {
          if (load.name == normalized[0] || load.name == normalized[1])
            return '(function() { var curSystem = System; ' + source + '\nSystem = curSystem; })();';

          return source;
        });

      return source;
    });

  };

}

/*
  SystemJS Global Format

  Supports
    metadata.deps
    metadata.init
    metadata.exports

  Also detects writes to the global object avoiding global collisions.
  See the SystemJS readme global support section for further information.
*/
function global(loader) {

  loader._extensions.push(global);

  function readGlobalProperty(p, value) {
    var pParts = p.split('.');
    while (pParts.length)
      value = value[pParts.shift()];
    return value;
  }

  function createHelpers(loader) {
    if (loader.has('@@global-helpers'))
      return;

    var hasOwnProperty = loader.global.hasOwnProperty;
    var moduleGlobals = {};

    var curGlobalObj;
    var ignoredGlobalProps;

    function makeLookupObject(arr) {
      var out = {};
      for(var i = 0, len = arr.length; i < len; i++) {
        out[arr[i]] = true;
      }
      return out;
    }

    loader.set('@@global-helpers', loader.newModule({
      prepareGlobal: function(moduleName, deps, exportName) {
        var globals;
        var require;

        // handle function signature when an object is passed instead of
        // individual arguments
        if (typeof moduleName === "object") {
          var options = moduleName;

          deps = options.deps;
          globals = options.globals;
          exportName = options.exportName;
          moduleName = options.moduleName;
          require = options.require;
        }

        // first, we add all the dependency modules to the global
        if (deps) {
          for (var i = 0; i < deps.length; i++) {
            var moduleGlobal = moduleGlobals[deps[i]];
            if (moduleGlobal)
              for (var m in moduleGlobal)
                loader.global[m] = moduleGlobal[m];
          }
        }

        if (globals && require) {
          for (var j in globals) {
            loader.global[j] = require(globals[j]);
          }
        }

        // If an exportName is defined there is no need to perform the next
        // expensive operation.
        if(exportName || exportName === false || loader.inferGlobals === false) {
          return;
        }

        // now store a complete copy of the global object
        // in order to detect changes
        curGlobalObj = {};
        ignoredGlobalProps = makeLookupObject(['indexedDB', 'sessionStorage', 'localStorage',
          'clipboardData', 'frames', 'webkitStorageInfo', 'toolbar', 'statusbar',
          'scrollbars', 'personalbar', 'menubar', 'locationbar', 'webkitIndexedDB',
          'screenTop', 'screenLeft'
        ]);
        for (var g in loader.global) {
          if (ignoredGlobalProps[g]) { continue; }
          if (!hasOwnProperty || loader.global.hasOwnProperty(g)) {
            try {
              curGlobalObj[g] = loader.global[g];
            } catch (e) {
              ignoredGlobalProps[g] = true;
            }
          }
        }
      },
      retrieveGlobal: function(moduleName, exportName, init) {
        var singleGlobal;
        var multipleExports;
        var exports = {};

        // run init
        if (init)
          singleGlobal = init.call(loader.global);

        // check for global changes, creating the globalObject for the module
        // if many globals, then a module object for those is created
        // if one global, then that is the module directly
        else if (exportName) {
          var firstPart = exportName.split('.')[0];
          singleGlobal = readGlobalProperty(exportName, loader.global);
          exports[firstPart] = loader.global[firstPart];
        }

        else if(exportName !== false && loader.inferGlobals !== false) {
          for (var g in loader.global) {
            if (ignoredGlobalProps[g])
              continue;
            if ((!hasOwnProperty || loader.global.hasOwnProperty(g)) && g != loader.global && curGlobalObj[g] != loader.global[g]) {
              exports[g] = loader.global[g];
              if (singleGlobal) {
                if (singleGlobal !== loader.global[g])
                  multipleExports = true;
              }
              else if (singleGlobal === undefined) {
                singleGlobal = loader.global[g];
              }
            }
          }
        }

        moduleGlobals[moduleName] = exports;

        return multipleExports ? exports : singleGlobal;
      }
    }));
  }

  createHelpers(loader);

  var loaderInstantiate = loader.instantiate;
  loader.instantiate = function(load) {
    var loader = this;

    createHelpers(loader);

    var exportName = load.metadata.exports;

    if (!load.metadata.format)
      load.metadata.format = 'global';

    // add globals as dependencies
    if (load.metadata.globals) {
      for (var g in load.metadata.globals) {
        load.metadata.deps.push(load.metadata.globals[g]);
      }
    }

    // global is a fallback module format
    if (load.metadata.format == 'global') {
      load.metadata.execute = function(require, exports, module) {
        loader.get('@@global-helpers').prepareGlobal({
          require: require,
          moduleName: module.id,
          exportName: exportName,
          deps: load.metadata.deps,
          globals: load.metadata.globals
        });

        if (exportName)
          load.source += '\nthis["' + exportName + '"] = ' + exportName + ';';

        // disable module detection
        var define = loader.global.define;
        var require = loader.global.require;

        loader.global.define = undefined;
        loader.global.module = undefined;
        loader.global.exports = undefined;

        loader.__exec(load, loader.global);

        loader.global.require = require;
        loader.global.define = define;

        return loader.get('@@global-helpers').retrieveGlobal(module.id, exportName, load.metadata.init);
      }
    }
    return loaderInstantiate.call(loader, load);
  }
}

/*
  SystemJS CommonJS Format
*/
function cjs(loader) {
  loader._extensions.push(cjs);

  // CJS Module Format
  // require('...') || exports[''] = ... || exports.asd = ... || module.exports = ...
  var cjsExportsRegEx = /(?:^\uFEFF?|[^$_a-zA-Z\xA0-\uFFFF.])(exports\s*(\[['"]|\.)|module(\.exports|\['exports'\]|\["exports"\])\s*(\[['"]|[=,\.]))/;
  // RegEx adjusted from https://github.com/jbrantly/yabble/blob/master/lib/yabble.js#L339
  var cjsRequireRegEx = /(?:^\uFEFF?|[^$_a-zA-Z\xA0-\uFFFF."'])require\s*\(\s*("[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')\s*\)/g;
  var commentRegEx = /(^|[^\\])(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg;

  var stringRegEx = /("[^"\\\n\r]*(\\.[^"\\\n\r]*)*"|'[^'\\\n\r]*(\\.[^'\\\n\r]*)*')/g;

  function getCJSDeps(source) {
    cjsRequireRegEx.lastIndex = commentRegEx.lastIndex = stringRegEx.lastIndex = 0;

    var deps = [];

    var match;

    // track string and comment locations for unminified source
    var stringLocations = [], commentLocations = [];

    function inLocation(locations, match) {
      for (var i = 0; i < locations.length; i++)
        if (locations[i][0] < match.index && locations[i][1] > match.index)
          return true;
      return false;
    }

    if (source.length / source.split('\n').length < 200) {
      while (match = stringRegEx.exec(source))
        stringLocations.push([match.index, match.index + match[0].length]);

      while (match = commentRegEx.exec(source)) {
        // only track comments not starting in strings
        if (!inLocation(stringLocations, match))
          commentLocations.push([match.index, match.index + match[0].length]);
      }
    }

    while (match = cjsRequireRegEx.exec(source)) {
      // ensure we're not within a string or comment location
      if (!inLocation(stringLocations, match) && !inLocation(commentLocations, match)) {
        var dep = match[1].substr(1, match[1].length - 2);
        // skip cases like require('" + file + "')
        if (dep.match(/"|'/))
          continue;
        deps.push(dep);
      }
    }

    return deps;
  }

  var loaderInstantiate = loader.instantiate;
  loader.instantiate = function(load) {

    if (!load.metadata.format) {
      cjsExportsRegEx.lastIndex = 0;
      cjsRequireRegEx.lastIndex = 0;
      if (cjsRequireRegEx.exec(load.source) || cjsExportsRegEx.exec(load.source))
        load.metadata.format = 'cjs';
    }

    if (load.metadata.format == 'cjs') {
      load.metadata.deps = load.metadata.deps ? load.metadata.deps.concat(getCJSDeps(load.source)) : getCJSDeps(load.source);

      load.metadata.executingRequire = true;

      load.metadata.execute = function(require, exports, module) {
        var dirname = (load.address || '').split('/');
        dirname.pop();
        dirname = dirname.join('/');

        // if on the server, remove the "file:" part from the dirname
        if (System._nodeRequire)
          dirname = dirname.substr(5);

        var globals = loader.global._g = {
          global: loader.global,
          exports: exports,
          module: module,
          require: require,
          __filename: System._nodeRequire ? load.address.substr(5) : load.address,
          __dirname: dirname
        };


        // disable AMD detection
        var define = loader.global.define;
        loader.global.define = undefined;

        var execLoad = {
          name: load.name,
          source: '(function() {\n(function(global, exports, module, require, __filename, __dirname){\n' + load.source +
                                  '\n}).call(_g.exports, _g.global, _g.exports, _g.module, _g.require, _g.__filename, _g.__dirname);})();',
          address: load.address
        };
        loader.__exec(execLoad);

        loader.global.define = define;

        loader.global._g = undefined;
      }
    }

    return loaderInstantiate.call(this, load);
  };
}

/*
  SystemJS AMD Format
  Provides the AMD module format definition at System.format.amd
  as well as a RequireJS-style require on System.require
*/
function amd(loader) {
  // by default we only enforce AMD noConflict mode in Node
  var isNode = typeof module != 'undefined' && module.exports;

  loader._extensions.push(amd);

  // AMD Module Format Detection RegEx
  // define([.., .., ..], ...)
  // define(varName); || define(function(require, exports) {}); || define({})
  var amdRegEx = /(?:^\uFEFF?|[^$_a-zA-Z\xA0-\uFFFF.])define\s*\(\s*("[^"]+"\s*,\s*|'[^']+'\s*,\s*)?\s*(\[(\s*(("[^"]+"|'[^']+')\s*,|\/\/.*\r?\n|\/\*(.|\s)*?\*\/))*(\s*("[^"]+"|'[^']+')\s*,?)?(\s*(\/\/.*\r?\n|\/\*(.|\s)*?\*\/))*\s*\]|function\s*|{|[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*\))/;

  var strictCommentRegEx = /\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm
  var commentRegEx = /(\/\*([\s\S]*?)\*\/|([^:(?!\\)]|^)\/\/(.*)$)/mg;
  var stringRegEx = /("[^"\\\n\r]*(\\.[^"\\\n\r]*)*"|'[^'\\\n\r]*(\\.[^'\\\n\r]*)*')/g;
  var beforeRegEx = /(function|var|let|const|return|export|\"|\'|\(|\=)$/i
  var cjsRequirePre = "(?:^\\uFEFF?|[^$_a-zA-Z\\xA0-\\uFFFF.\"\'])";
  var cjsRequirePost = "\\s*\\(\\s*(\"[^\"\\\\]*(?:\\\\.[^\"\\\\]*)*\"|\'[^\'\\\\]*(?:\\\\.[^\'\\\\]*)*\')\\s*\\)";

  var fnBracketRegEx = /\(([^\)]*)\)/;
  var wsRegEx = /^\s+|\s+$/g;

  var requireRegExs = {};

  function getCJSDeps(source, requireIndex) {
    commentRegEx.lastIndex = stringRegEx.lastIndex = 0;
    var stringLocations = [], commentLocations = [];

    var match;

    function inLocation(locations, index) {
      for (var i = 0; i < locations.length; i++)
        if (locations[i][0] < index && locations[i][1] > index)
          return true;
      return false;
    }

    while (match = stringRegEx.exec(source))
      stringLocations.push([match.index, match.index + match[0].length]);

    while (match = commentRegEx.exec(source)) {
      // only track comments not starting in strings
      if (!inLocation(stringLocations, match.index + 1))
        commentLocations.push([match.index, match.index + match[0].length]);
    }

    // determine the require alias
    var params = source.match(fnBracketRegEx);
    var requireAlias = (params[1].split(',')[requireIndex] || 'require').replace(wsRegEx, '');

    // find or generate the regex for this requireAlias
    var requireRegEx = requireRegExs[requireAlias] || (requireRegExs[requireAlias] = new RegExp(cjsRequirePre + requireAlias + cjsRequirePost, 'g'));

    requireRegEx.lastIndex = 0;

    var deps = [];

    while (match = requireRegEx.exec(source)) {
      if(!inLocation(stringLocations, match.index) &&
        !inLocation(commentLocations, match.index)) {
        var dep = match[1].substr(1, match[1].length - 2);
        if(dep)
          deps.push(dep);
      }
    }

    return deps;
  }

  /*
    AMD-compatible require
    To copy RequireJS, set window.require = window.requirejs = loader.amdRequire
  */
  function require(names, callback, errback, referer) {
    // 'this' is bound to the loader
    var loader = this;

    // in amd, first arg can be a config object... we just ignore
    if (typeof names == 'object' && !(names instanceof Array))
      return require.apply(null, Array.prototype.splice.call(arguments, 1, arguments.length - 1));

    // amd require
    if (names instanceof Array)
      Promise.all(names.map(function(name) {
        return loader['import'](name, referer);
      })).then(function(modules) {
        if(callback) {
          callback.apply(null, modules);
        }
      }, errback);

    // commonjs require
    else if (typeof names == 'string') {
      var module = loader.get(names);
      return module.__useDefault ? module['default'] : module;
    }

    else
      throw new TypeError('Invalid require');
  };
  loader.amdRequire = function() {
    return require.apply(this, arguments);
  };

  function makeRequire(parentName, staticRequire, loader) {
    return function(names, callback, errback) {
      if (typeof names == 'string')
        return staticRequire(names);
      return require.call(loader, names, callback, errback, { name: parentName });
    }
  }

  // run once per loader
  function generateDefine(loader) {
    // script injection mode calls this function synchronously on load
    var onScriptLoad = loader.onScriptLoad;
    loader.onScriptLoad = function(load) {
      onScriptLoad(load);
      if (anonDefine || defineBundle) {
        load.metadata.format = 'defined';
        load.metadata.registered = true;
      }

      if (anonDefine) {
        load.metadata.deps = load.metadata.deps ? load.metadata.deps.concat(anonDefine.deps) : anonDefine.deps;
        load.metadata.execute = anonDefine.execute;
      }
    }

    function define(name, deps, factory) {
      if (typeof name != 'string') {
        factory = deps;
        deps = name;
        name = null;
      }
      if (!(deps instanceof Array)) {
        factory = deps;
        deps = ['require', 'exports', 'module'];
      }

      if (typeof factory != 'function')
        factory = (function(factory) {
          return function() { return factory; }
        })(factory);

      // in IE8, a trailing comma becomes a trailing undefined entry
      if (deps[deps.length - 1] === undefined)
        deps.pop();

      // remove system dependencies
      var requireIndex, exportsIndex, moduleIndex;

      if ((requireIndex = indexOf.call(deps, 'require')) != -1) {

        deps.splice(requireIndex, 1);

        var factoryText = factory.toString();

        deps = deps.concat(getCJSDeps(factoryText, requireIndex));
      }


      if ((exportsIndex = indexOf.call(deps, 'exports')) != -1)
        deps.splice(exportsIndex, 1);

      if ((moduleIndex = indexOf.call(deps, 'module')) != -1)
        deps.splice(moduleIndex, 1);

      var define = {
        deps: deps,
        execute: function(require, exports, module) {

          var depValues = [];
          for (var i = 0; i < deps.length; i++)
            depValues.push(require(deps[i]));

          module.uri = loader.baseURL + module.id;

          module.config = function() {};

          // add back in system dependencies
          if (moduleIndex != -1)
            depValues.splice(moduleIndex, 0, module);

          if (exportsIndex != -1)
            depValues.splice(exportsIndex, 0, exports);

          if (requireIndex != -1)
            depValues.splice(requireIndex, 0, makeRequire(module.id, require, loader));

          var output = factory.apply(global, depValues);

          if (typeof output == 'undefined' && module)
            output = module.exports;

          if (typeof output != 'undefined')
            return output;
        }
      };

      // anonymous define
      if (!name) {
        // already defined anonymously -> throw
        if (anonDefine)
          throw new TypeError('Multiple defines for anonymous module');
        anonDefine = define;
      }
      // named define
      else {
        // if it has no dependencies and we don't have any other
        // defines, then let this be an anonymous define
        if (deps.length == 0 && !anonDefine && !defineBundle)
          anonDefine = define;

        // otherwise its a bundle only
        else
          anonDefine = null;

        // the above is just to support single modules of the form:
        // define('jquery')
        // still loading anonymously
        // because it is done widely enough to be useful

        // note this is now a bundle
        defineBundle = true;

        // define the module through the register registry
        loader.register(name, define.deps, false, define.execute);
      }
    };
    define.amd = {};
    loader.amdDefine = define;
  }

  var anonDefine;
  // set to true if the current module turns out to be a named define bundle
  var defineBundle;

  var oldModule, oldExports, oldDefine;

  // adds define as a global (potentially just temporarily)
  function createDefine(loader) {
    if (!loader.amdDefine)
      generateDefine(loader);

    anonDefine = null;
    defineBundle = null;

    // ensure no NodeJS environment detection
    var global = loader.global;

    oldModule = global.module;
    oldExports = global.exports;
    oldDefine = global.define;

    global.module = undefined;
    global.exports = undefined;

    if (global.define && global.define === loader.amdDefine)
      return;

    global.define = loader.amdDefine;
  }

  function removeDefine(loader) {
    var global = loader.global;
    global.define = oldDefine;
    global.module = oldModule;
    global.exports = oldExports;
  }

  generateDefine(loader);

  if (loader.scriptLoader) {
    var loaderFetch = loader.fetch;
    loader.fetch = function(load) {
      createDefine(this);
      return loaderFetch.call(this, load);
    }
  }

  var loaderInstantiate = loader.instantiate;
  loader.instantiate = function(load) {
    var loader = this,
      sourceWithoutComments = load.source.replace(strictCommentRegEx, '$1'),
      match = sourceWithoutComments.match(amdRegEx);

    if (load.metadata.format == 'amd' || !load.metadata.format && match) {

      // make sure that this is really a AMD module
      // get the content from beginning till the matched define block
      var sourceBeforeDefine = sourceWithoutComments.substring(0, sourceWithoutComments.indexOf(match[0])),
        trimmed = sourceBeforeDefine.replace(wsRegEx, "")

      // check if that there is no commen javscript keywork before
      if (!beforeRegEx.test(trimmed)) {
        load.metadata.format = 'amd';

        if (loader.execute !== false) {
          createDefine(loader);

          loader.__exec(load);

          removeDefine(loader);

          if (!anonDefine && !defineBundle && !isNode)
            throw new TypeError('AMD module ' + load.name + ' did not define');
        }

        if (anonDefine) {
          load.metadata.deps = load.metadata.deps ? load.metadata.deps.concat(anonDefine.deps) : anonDefine.deps;
          load.metadata.execute = anonDefine.execute;
        }
      }
    }

    return loaderInstantiate.call(loader, load);
  }
}

/*
  SystemJS map support
  
  Provides map configuration through
    System.map['jquery'] = 'some/module/map'

  As well as contextual map config through
    System.map['bootstrap'] = {
      jquery: 'some/module/map2'
    }

  Note that this applies for subpaths, just like RequireJS

  jquery      -> 'some/module/map'
  jquery/path -> 'some/module/map/path'
  bootstrap   -> 'bootstrap'

  Inside any module name of the form 'bootstrap' or 'bootstrap/*'
    jquery    -> 'some/module/map2'
    jquery/p  -> 'some/module/map2/p'

  Maps are carefully applied from most specific contextual map, to least specific global map
*/
function map(loader) {
  loader.map = loader.map || {};

  loader._extensions.push(map);

  // return if prefix parts (separated by '/') match the name
  // eg prefixMatch('jquery/some/thing', 'jquery') -> true
  //    prefixMatch('jqueryhere/', 'jquery') -> false
  function prefixMatch(name, prefix) {
    if (name.length < prefix.length)
      return false;
    if (name.substr(0, prefix.length) != prefix)
      return false;
    if (name[prefix.length] && name[prefix.length] != '/')
      return false;
    return true;
  }

  // get the depth of a given path
  // eg pathLen('some/name') -> 2
  function pathLen(name) {
    var len = 1;
    for (var i = 0, l = name.length; i < l; i++)
      if (name[i] === '/')
        len++;
    return len;
  }

  function doMap(name, matchLen, map) {
    return map + name.substr(matchLen);
  }

  // given a relative-resolved module name and normalized parent name,
  // apply the map configuration
  function applyMap(name, parentName, loader) {
    var curMatch, curMatchLength = 0;
    var curParent, curParentMatchLength = 0;
    var tmpParentLength, tmpPrefixLength;
    var subPath;
    var nameParts;
    
    // first find most specific contextual match
    if (parentName) {
      for (var p in loader.map) {
        var curMap = loader.map[p];
        if (typeof curMap != 'object')
          continue;

        // most specific parent match wins first
        if (!prefixMatch(parentName, p))
          continue;

        tmpParentLength = pathLen(p);
        if (tmpParentLength <= curParentMatchLength)
          continue;

        for (var q in curMap) {
          // most specific name match wins
          if (!prefixMatch(name, q))
            continue;
          tmpPrefixLength = pathLen(q);
          if (tmpPrefixLength <= curMatchLength)
            continue;

          curMatch = q;
          curMatchLength = tmpPrefixLength;
          curParent = p;
          curParentMatchLength = tmpParentLength;
        }
      }
    }

    // if we found a contextual match, apply it now
    if (curMatch)
      return doMap(name, curMatch.length, loader.map[curParent][curMatch]);

    // now do the global map
    for (var p in loader.map) {
      var curMap = loader.map[p];
      if (typeof curMap != 'string')
        continue;

      if (!prefixMatch(name, p))
        continue;

      var tmpPrefixLength = pathLen(p);

      if (tmpPrefixLength <= curMatchLength)
        continue;

      curMatch = p;
      curMatchLength = tmpPrefixLength;
    }

    if (curMatch)
      return doMap(name, curMatch.length, loader.map[curMatch]);

    return name;
  }

  var loaderNormalize = loader.normalize;
  loader.normalize = function(name, parentName, parentAddress) {
    var loader = this;
    if (!loader.map)
      loader.map = {};

    var isPackage = false;
    if (name.substr(name.length - 1, 1) == '/') {
      isPackage = true;
      name += '#';
    }

    return Promise.resolve(loaderNormalize.call(loader, name, parentName, parentAddress))
    .then(function(name) {
      name = applyMap(name, parentName, loader);

      // Normalize "module/" into "module/module"
      // Convenient for packages
      if (isPackage) {
        var nameParts = name.split('/');
        nameParts.pop();
        var pkgName = nameParts.pop();
        nameParts.push(pkgName);
        nameParts.push(pkgName);
        name = nameParts.join('/');
      }

      return name;
    });
  }
}

/*
  SystemJS Plugin Support

  Supports plugin syntax with "!"

  The plugin name is loaded as a module itself, and can override standard loader hooks
  for the plugin resource. See the plugin section of the systemjs readme.
*/
function plugins(loader) {
  if (typeof indexOf == 'undefined')
    indexOf = Array.prototype.indexOf;

  loader._extensions.push(plugins);

  var loaderNormalize = loader.normalize;
  loader.normalize = function(name, parentName, parentAddress) {
    var loader = this;
    // if parent is a plugin, normalize against the parent plugin argument only
    var parentPluginIndex;
    if (parentName && (parentPluginIndex = parentName.indexOf('!')) != -1)
      parentName = parentName.substr(0, parentPluginIndex);

    return Promise.resolve(loaderNormalize.call(loader, name, parentName, parentAddress))
    .then(function(name) {
      // if this is a plugin, normalize the plugin name and the argument
      var pluginIndex = name.lastIndexOf('!');
      if (pluginIndex != -1) {
        var argumentName = name.substr(0, pluginIndex);

        // plugin name is part after "!" or the extension itself
        var pluginName = name.substr(pluginIndex + 1) || argumentName.substr(argumentName.lastIndexOf('.') + 1);

        // normalize the plugin name relative to the same parent
        return new Promise(function(resolve) {
          resolve(loader.normalize(pluginName, parentName, parentAddress));
        })
        // normalize the plugin argument
        .then(function(_pluginName) {
          pluginName = _pluginName;
          return loader.normalize(argumentName, parentName, parentAddress, true);
        })
        .then(function(argumentName) {
          return argumentName + '!' + pluginName;
        });
      }

      // standard normalization
      return name;
    });
  };

  var loaderLocate = loader.locate;
  loader.locate = function(load) {
    var loader = this;

    var name = load.name;

    // only fetch the plugin itself if this name isn't defined
    if (this.defined && this.defined[name])
      return loaderLocate.call(this, load);

    // plugin
    var pluginIndex = name.lastIndexOf('!');
    if (pluginIndex != -1) {
      var pluginName = name.substr(pluginIndex + 1);

      // the name to locate is the plugin argument only
      load.name = name.substr(0, pluginIndex);

      var pluginLoader = loader.pluginLoader || loader;

      // load the plugin module
      // NB ideally should use pluginLoader.load for normalized,
      //    but not currently working for some reason
      return pluginLoader['import'](pluginName, {
        metadata: { importingModuleName: name }
      })
      .then(function() {
        var plugin = pluginLoader.get(pluginName);
        plugin = plugin['default'] || plugin;

        // allow plugins to opt-out of build
        if (plugin.build === false && loader.pluginLoader)
          load.metadata.build = false;

        // store the plugin module itself on the metadata
        load.metadata.plugin = plugin;
        load.metadata.pluginName = pluginName;
        load.metadata.pluginArgument = load.name;
        load.metadata.buildType = plugin.buildType || "js";

        // run plugin locate if given
        if (plugin.locate)
          return plugin.locate.call(loader, load);

        // otherwise use standard locate without '.js' extension adding
        else
          return Promise.resolve(loader.locate(load))
          .then(function(address) {
            return address.replace(/\.js$/, '');
          });
      });
    }

    return loaderLocate.call(this, load);
  };

  var loaderFetch = loader.fetch;
  loader.fetch = function(load) {
    var loader = this;
    // ignore fetching build = false unless in a plugin loader
    if (load.metadata.build === false && loader.pluginLoader)
      return '';
    else if (load.metadata.plugin && load.metadata.plugin.fetch && !load.metadata.pluginFetchCalled) {
      load.metadata.pluginFetchCalled = true;
      return load.metadata.plugin.fetch.call(loader, load, loaderFetch);
    }
    else
      return loaderFetch.call(loader, load);
  };

  var loaderTranslate = loader.translate;
  loader.translate = function(load) {
    var loader = this;
    if (load.metadata.plugin && load.metadata.plugin.translate)
      return Promise.resolve(load.metadata.plugin.translate.call(loader, load)).then(function(result) {
        if (typeof result == 'string')
          load.source = result;
        return loaderTranslate.call(loader, load);
      });
    else
      return loaderTranslate.call(loader, load);
  };

  var loaderInstantiate = loader.instantiate;
  loader.instantiate = function(load) {
    var loader = this;
    if (load.metadata.plugin && load.metadata.plugin.instantiate)
       return Promise.resolve(load.metadata.plugin.instantiate.call(loader, load)).then(function(result) {
        if (result) {
          // load.metadata.format = 'defined';
          // load.metadata.execute = function() {
          //   return result;
          // };
          return result;
        }
        return loaderInstantiate.call(loader, load);
      });
    else if (load.metadata.plugin && load.metadata.plugin.build === false) {
      load.metadata.format = 'defined';
      load.metadata.deps.push(load.metadata.pluginName);
      load.metadata.execute = function() {
        return loader.newModule({});
      };
      return loaderInstantiate.call(loader, load);
    }
    else
      return loaderInstantiate.call(loader, load);
  }

}

/*
  System bundles

  Allows a bundle module to be specified which will be dynamically 
  loaded before trying to load a given module.

  For example:
  System.bundles['mybundle'] = ['jquery', 'bootstrap/js/bootstrap']

  Will result in a load to "mybundle" whenever a load to "jquery"
  or "bootstrap/js/bootstrap" is made.

  In this way, the bundle becomes the request that provides the module
*/

function bundles(loader) {
  if (typeof indexOf == 'undefined')
    indexOf = Array.prototype.indexOf;

  loader._extensions.push(bundles);

  // bundles support (just like RequireJS)
  // bundle name is module name of bundle itself
  // bundle is array of modules defined by the bundle
  // when a module in the bundle is requested, the bundle is loaded instead
  // of the form System.bundles['mybundle'] = ['jquery', 'bootstrap/js/bootstrap']
  loader.bundles = loader.bundles || {};

  var loaderFetch = loader.fetch;
  loader.fetch = function(load) {
    var loader = this;
    if (loader.trace)
      return loaderFetch.call(this, load);
    if (!loader.bundles)
      loader.bundles = {};

    // if this module is in a bundle, load the bundle first then
    for (var b in loader.bundles) {
      if (indexOf.call(loader.bundles[b], load.name) == -1)
        continue;
      // we do manual normalization in case the bundle is mapped
      // this is so we can still know the normalized name is a bundle
      return Promise.resolve(loader.normalize(b))
      .then(function(normalized) {
        loader.bundles[normalized] = loader.bundles[normalized] || loader.bundles[b];

        // note this module is a bundle in the meta
        loader.meta = loader.meta || {};
        loader.meta[normalized] = loader.meta[normalized] || {};
        loader.meta[normalized].bundle = true;

        return loader.load(normalized);
      })
      .then(function() {
        return '';
      });
    }
    return loaderFetch.call(this, load);
  }
}

/*
 * Dependency Tree Cache
 * 
 * Allows a build to pre-populate a dependency trace tree on the loader of 
 * the expected dependency tree, to be loaded upfront when requesting the
 * module, avoinding the n round trips latency of module loading, where 
 * n is the dependency tree depth.
 *
 * eg:
 * System.depCache = {
 *  'app': ['normalized', 'deps'],
 *  'normalized': ['another'],
 *  'deps': ['tree']
 * };
 * 
 * System.import('app') 
 * // simultaneously starts loading all of:
 * // 'normalized', 'deps', 'another', 'tree'
 * // before "app" source is even loaded
 */

function depCache(loader) {
  loader.depCache = loader.depCache || {};

  loader._extensions.push(depCache);

  var loaderLocate = loader.locate;
  loader.locate = function(load) {
    var loader = this;

    if (!loader.depCache)
      loader.depCache = {};

    // load direct deps, in turn will pick up their trace trees
    var deps = loader.depCache[load.name];
    if (deps)
      for (var i = 0; i < deps.length; i++)
        loader.load(deps[i]);

    return loaderLocate.call(loader, load);
  }
}
  

core(System);
meta(System);
register(System);
es6(System);
global(System);
cjs(System);
amd(System);
map(System);
plugins(System);
bundles(System);
depCache(System);

};

var $__curScript, __eval;

(function() {

  var doEval;
  var isWorker = typeof window == 'undefined' && typeof self != 'undefined' && typeof importScripts != 'undefined';
  var isBrowser = typeof window != 'undefined' && typeof document != 'undefined';
  var isNode = typeof process === 'object' && {}.toString.call(process) === '[object process]';
  var isNW = !!(isNode && global.nw && global.nw.process);
  var isChromeExtension = isBrowser && !isNW && window.chrome && window.chrome.extension;
  var scriptEval;

  doEval = function(source, address, context) {
    try {
      new Function(source).call(context);
    }
    catch(e) {
      throw addToError(e, 'Evaluating ' + address);
    }
  };

  if(isWorker) {
    $__global.upgradeSystemLoader();
  } else if ((isBrowser || isNW) && !isChromeExtension) {
    var head;

    var scripts = document.getElementsByTagName('script');
    $__curScript = scripts[scripts.length - 1];

    // globally scoped eval for the browser
    scriptEval = function(source) {
      if (!head)
        head = document.head || document.body || document.documentElement;

      var script = document.createElement('script');
      script.text = source;
      var onerror = window.onerror;
      var e;
      window.onerror = function(_e) {
        e = _e;
      }
      head.appendChild(script);
      head.removeChild(script);
      window.onerror = onerror;
      if (e)
        throw e;
    };

    $__global.upgradeSystemLoader();
  }
  else if(isNode) {
    var es6ModuleLoader = require('./src/loader');
    $__global.System = es6ModuleLoader.System;
    $__global.Loader = es6ModuleLoader.Loader;
    $__global.upgradeSystemLoader();
    module.exports = $__global.System;

    // global scoped eval for node
    var vm = require('vm');
    doEval = function(source) {
      vm.runInThisContext(source);
    }
  }

  var errArgs = new Error(0, '_').fileName == '_';

  function addToError(err, msg) {
    // parse the stack removing loader code lines for simplification
    if (!err.originalErr) {
      var stack = (err.stack || err.message || err).toString().split('\n');
      var newStack = [];
      for (var i = 0; i < stack.length; i++) {
        if (typeof $__curScript == 'undefined' || stack[i].indexOf($__curScript.src) == -1)
          newStack.push(stack[i]);
      }
    }

    var newMsg = (newStack ? newStack.join('\n\t') : err.message) + '\n\t' + msg;

    // Convert file:/// URLs to paths in Node
    if (!isBrowser)
      newMsg = newMsg.replace(isWindows ? /file:\/\/\//g : /file:\/\//g, '');

    var newErr = errArgs ? new Error(newMsg, err.fileName, err.lineNumber) : new Error(newMsg);

    // Node needs stack adjustment for throw to show message
    if (!isBrowser)
      newErr.stack = newMsg;
    // Clearing the stack stops unnecessary loader lines showing
    else
      newErr.stack = null;

    // track the original error
    newErr.originalErr = err.originalErr || err;

    return newErr;
  }

  __eval = function(source, address, context, sourceMap, evalType) {
    source += '\n//# sourceURL=' + address + (sourceMap ? '\n//# sourceMappingURL=' + sourceMap : '');


    var useScriptEval = evalType === 'script'
      && typeof scriptEval === 'function';
    if(useScriptEval) {
      scriptEval(source);
    } else {
      doEval(source, address, context);
    }
  };

})();

})(typeof window != 'undefined' ? window : (typeof WorkerGlobalScope != 'undefined' ? self : global));

	if( isNode && !isNW && !isElectron ) {

		global.steal = makeSteal(System);
		global.steal.System = System;
		global.steal.dev = require("./ext/dev.js");
		steal.clone = cloneSteal;
		module.exports = global.steal;

	} else {
		var oldSteal = global.steal;
		global.steal = makeSteal(System);
		global.steal.startup(oldSteal && typeof oldSteal == 'object' && oldSteal)
			.then(null, function(error){
				if(typeof console !== "undefined") {
					// Hide from uglify
					var c = console;
					var type = c.error ? "error" : "log";
					c[type](error, error.stack);
				}
			});
		global.steal.clone = cloneSteal;
	}

})(typeof window == "undefined" ? (typeof global === "undefined" ? this : global) : window);
