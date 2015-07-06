(function(){

    var path = require('path');
    var argsList = require('args-list');

    function ucFirst(str) {
        return str[0].toLowerCase() + str.slice(1);
    }

    function normalizeKey(key) {
        // if the key is a path, only use the suffix
        var lastSlash = key.lastIndexOf('/');
        key = key.substr(lastSlash + 1);

        // don't need the file extension for the key
        if (key.indexOf('.js', key.length - 3) !== -1) {
            key = key.substr(0, key.length - 3);
        }

        return key;
    }

    /**
     * Creates a new container
     *
     * @param {string} [path] - The base path of relatively included modules
     * @param {container} [_parent] - The parent scope for this container
     *
     * @returns {container}
     */
    var create = function(path, _parent) {

        var newContainer = Object.create(container);

        newContainer._definitions = {};
        newContainer._intact = {};
        newContainer._singletons = {};
        newContainer._inflectors = [];
        newContainer._sub = [];
        newContainer._aliases = {};
        newContainer._path =  path || '';

        if (container.isPrototypeOf(_parent)) {
            newContainer.parent = function parent(){return _parent};
            newContainer._path = path || _parent._path;
            newContainer._aliases = Object.create(_parent._aliases);
        }

        newContainer.singleton("ioc", newContainer);

        return newContainer;
    };

    var stubContainer = {
        has: function has(){return false;},
        get: function get(){return undefined;},
        inflect: function(){}
    };

    var container = {

        /**
         * Registers a value in the container
         *
         * If only a single parameter is passed and it is a string then it is
         * assumed to be a module name (unless the intact parameter is set to true).
         * In such a case, a key will be extracted based on the path.
         *
         * If key is a container object, it will be added as a sub-container.
         *
         * If key is a hash of strings and values, each of the properties will be
         * added to the container with the key as the keyname and the value as the
         * definition.
         *
         * If key is an array, all of the values will be added to the container with
         * the definition provided.
         *
         * Otherwise, the key will be registered with the given definition.  If the
         * definition is a function, it is assumed to be a factory which will be invoked
         * when the value is retrieved with its parameters resolved by the container.
         * If the definition is a string, it is assumed to be a module name which will
         * be loaded and then invoked if the value is a function, otherwise returned as is.
         *
         * @param {String|Array|Object} key
         * @param {*} [definition]
         * @param {Boolean} [singleton]
         * @param {Boolean} [intact]
         *
         * @returns {container}
         * @api public
         */
        register: function register(key, definition, singleton, intact) {
            var self = this;

            // register a sub container
            if (container.isPrototypeOf(key)) {
                this._sub.push(key);
                return this;
            }

            // either an array of keys or an array of child containers
            if (Array.isArray(key)) {
                key.forEach(function(value){
                    self.register(value, definition, singleton, intact)
                });
                return this;
            }

            // a hash of definitions
            if (typeof key === 'object' && key != null) {
                var k;
                for (k in key) {
                    if (key.hasOwnProperty(k)) {
                        this.register(k, key[k]);
                    }
                }
                return this;
            }

            // if we've gotten this far, the key better be a string
            if (!key instanceof String) {
                throw new Error('Attempt to set invalid key in the container');
            }

            // the key can be the definition
            definition = typeof definition === 'undefined' ? key : definition;

            key = normalizeKey(key);

            this._singletons[key] = !!singleton;
            this._intact[key] = !!intact;

            // string definitions are assumed to be file paths
            // the file will be required and invoked if it is a function
            if (typeof definition === 'string' && !this._intact[key]) {
                if (definition[0] === '.') {
                    definition = path.resolve(this._path, definition);
                }
            }

            this._definitions[key] = definition;

            return this;
        },

        /**
         * Registers a singleton in the container
         *
         * @param {String|Array|Object} key
         * @param {*} [definition]
         * @returns {container}
         * @api public
         */
        singleton: function singleton(key, definition) {
            return this.register(key, definition, true, false);
        },

        /**
         * Registers a literal value in the container
         *
         * @param {String|Array|Object} key
         * @param {*} definition
         * @returns {container}
         * @api public
         */
        intact: function intact(key, definition) {
            return this.register(key, definition, false, true);
        },

        /**
         * Returns an array of arguments that can be applied to func
         *
         * @param {Function} func
         * @param {Object} [args]
         * @returns {Array}
         */
        resolve: function resolve(func, args) {
            args = args || {};
            var self = this;
            var depends = argsList(func);

            return depends.map(function(argName) {
                return typeof args[argName] !== 'undefined' ? args[argName] : self.get(argName);
            });
        },

        /**
         * Invokes a function with the registered and passed arguments
         *
         * If func is not a function, func is returned as is.
         *
         * @param {function|*} func
         * @param {object} [args] - a hash of named arguments for the function
         * @returns {*}
         */
        invoke: function invoke(func, args) {
            args = args || {};

            // make sure its really a function
            if (typeof func !== 'function') {
                return func;
            }

            // it could be a constructor
            var thisArg = Object.create(func.prototype);

            var resolvedArgs = this.resolve(func, args);

            var result = func.apply(thisArg, resolvedArgs) || thisArg;

            if (typeof result === 'object') {
                this.inflect(result, args);
            }

            return result;
        },

        /**
         * Performs setter and property injection
         *
         * @param {Object} obj
         * @param {Object} args
         * @returns {container}
         */
        inflect: function inflect(obj, args) {
            var self = this;
            this._inflectors.forEach(function(inflector){
                if (typeof obj[inflector] === 'function') {
                    obj[inflector].apply(obj, self.resolve(obj[inflector], args));
                } else if (typeof obj[inflector] !== 'undefined') {
                    // TODO: SHOULD it be required to be null or a falsey value in order to be set??
                    obj[inflector] = args[inflector] || self.get(inflector) || obj[inflector];
                }
            });

            this.parent().inflect(obj, args);

            return this;
        },

        /**
         * Registers a setter or property injector
         *
         * @param {string} inflectorName - The name of the property or setter function
         * @returns {container}
         */
        inflector: function inflector(inflectorName) {
            this._inflectors.push(inflectorName);
            return this;
        },

        /**
         * Creates an alias for a key in the container
         *
         * The alias is resolved at the time the value is retrieved
         * from the container and is inherited by scoped containers.
         *
         * @param key
         * @param aliasedKey
         */
        alias: function(key, aliasedKey) {
            this._aliases[key] = aliasedKey;
        },

        /**
         * Attempts to get a key in a containers sub containers
         *
         * @param key
         * @param args
         * @returns {*}
         * @private
         */
        _subGet: function _subGet(key, args) {
            var i, l;
            for (i = 0, l = this._sub.length; i < l; i++) {
                if (this._sub[i].has(key)) {
                    return this._sub[i].get(key, args);
                }
            }

            return undefined;
        },

        /**
         * Determines if a sub container has a key registered
         *
         * @param key
         * @returns {boolean}
         * @private
         */
        _subHas: function _subHas(key) {
            var i, l;
            for (i = 0, l = this._sub.length; i < l; i++) {
                if (this._sub[i].has(key)) {
                    return true;
                }
            }

            return false;
        },

        /**
         * Retrieves a registered value from the container.
         *
         * Unless specified as 'intact', a retrieved function is
         * treated as a factory which is invoked.
         *
         * @param {string} key - The registered key
         * @param {object} [args] - A hash of parameters used if the value is a function
         * @returns {*}
         */
        get: function get(key, args) {
            args = typeof args === 'object' ? args : {};

            // the key has to be a string
            if (typeof key !== "string") {
                return undefined;
            }

            if (typeof this._aliases[key] !== 'undefined') {
                return this.get(this._aliases[key], args);
            }

            if (typeof this._definitions[key] === 'undefined') {
                return this._subGet(key, args) || this.parent().get(key, args);
            }

            // strings are module names unless specified
            if (typeof this._definitions[key] === 'string' && !this._intact[key]) {
                this._definitions[key] = require(this._definitions[key]);
            }

            // functions are factories unless otherwise stated
            if (typeof this._definitions[key] === 'function' && !this._intact[key]) {

                if (this._singletons[key]) {
                    // singletons should not be modified by passed arguments
                    args = {};
                }

                var result = this.invoke(this._definitions[key], args);

                // this could be a factory for a shared object
                if (this._singletons[key]) {
                    this._definitions[key] = result;

                    // if the factory returns a function, we keep it intact
                    this._intact[key] = true;
                }

                return result;
            }

            return this._definitions[key];
        },

        /**
         * Returns true if the key can be retrieved by the container
         *
         * @param {string} key
         * @returns {boolean}
         */
        has: function has(key) {
            return typeof this._definitions[key] != 'undefined'
                || this._subHas(key)
                || this.parent().has(key)
        },

        /**
         * Creates a new scope from the container.
         *
         * This method is useful for adding values to the container
         * that should not be permanent.  For example, it can be
         * used to create a container that is valid only for the
         * duration of a single request.
         *
         * @param [definitions]
         * @returns {container}
         */
        scope: function scope(definitions) {
            definitions = definitions || {};
            var container = create(this._path, this);
            return container.register(definitions);
        },

        /**
         * Creates a sub container for this container.
         *
         * The primary use of a sub container is to specify
         * module definitions with a different relative path
         *
         * @param {string} [path]
         * @param {object} [definitions]
         * @returns {container} The sub-container
         */
        sub: function sub(path, definitions) {
            definitions = definitions || {};
            path = path || this._path;
            var subContainer = create(path);
            this.register(subContainer);
            return subContainer.register(definitions);
        },

        /**
         * Returns the parent scope of a scoped container
         *
         * @returns {{has: Function, get: Function, inflect: Function}}
         */
        parent: function parent() {
            return stubContainer;
        },

        /**
         * Uses the container to partially apply a function
         * 
         * Keys should be an array of strings or comma-separated string of keys
         * registered in the container.  If keys is instead a function,
         * it is assumed that all of the functions parameters should be
         * partially applied according to their names.
         * 
         * Empty strings passed in keys means that the parameter is expected to be
         * passed at invocation time.
         * 
         * @param {string|string[]|function} keys
         * @param {function} [func]
         * @returns {function}
         */
        prepare: function prepare(keys, func) {
            if (typeof keys === 'function') {
                func = keys;
                keys = argsList(func);
            } else if (typeof keys === 'string') {
                keys = keys.replace(/\s/g, '').split(',');
            }

            var numArgs = func.length;
            var self = this;

            return function prepared() {
                var passedArgs = Array.prototype.slice.call(arguments);
                var i;
                var resolvedArgs = [];
                for (i = 0; i < numArgs; i++) {
                    if (keys[i]) {
                        resolvedArgs.push(self.get(keys[i]));
                    } else {
                        resolvedArgs.push(passedArgs.shift());
                    }
                }

                var thisArg = Object.create(func.prototype);
                return func.apply(thisArg, resolvedArgs) || thisArg;
            }
        }
    };

    exports.create = create;

}).call(this);