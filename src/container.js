(function(){
    let path = require('path');
    let argsList = require('args-list');

    let _values = {};
    let _intact = {};
    let _shared = {};
    let _setters = [];
    let _config = {
        basePath: './'
    };

    function lcFirst(str) {
        return str[0].toLowerCase() + str.slice(1);
    }

    class Container {
        constructor(config) {
            _config.basePath = config.basePath || './';
        }

        get(key, args = {}) {

            /* The key has to be a string */
            if (typeof key !== "string") {
                return undefined;
            }

            /* Functions are factories unless otherwise specified */
            if (typeof _values[key] === 'function' && !_intact[key]) {
                let result = this.invoke(_values[key], args);

                /* This could be a factory for a shared object */
                if (_shared[key]) {
                    _values[key] = result;

                    /* If for some reason the factory returns a function, we keep it */
                    _intact[key] = true;
                }

                return result;
            }

            /* Return the value for the key (may be undefined) */
            return _values[key];
        }

        resolveArguments(func, args) {
            return argsList(func).map(
                    argName => typeof args[argName] !== 'undefined' ? args[argName] : this.get(argName)
            );
        }

        invoke(func, args = {}) {
            /* Make sure we are dealing with a function */
            if (typeof func !== 'function') {
                return func;
            }

            /* Create a this argument in case the function is a constructor */
            let thisArg = Object.create(func.prototype);

            /* Determine what arguments will be applied to the function */
            let resolved = this.resolveArguments(func, args);

            /* If the invocation returns a value, use that, otherwise return the this argument */
            let result = func.apply(thisArg, resolved) || thisArg;

            /* Apply setters */
            if (typeof result === 'object') {
                _setters.forEach(setter => {
                    if (typeof result[setter] === 'function') {
                        result[setter].apply(result, this.resolveArguments(result[setter], args));
                    }

                    // TODO: should setters work on properties?
                })
            }

            return result;
        }

        register(key, definition, shared = false, intact = false) {

            /* The key has to be a string */
            if (typeof key !== 'string') {
                return;
            }

            /* The definition parameter is optional */
            if (typeof definition === 'undefined') {
                definition = key;
            }

            /* A relative path */
            let lastSlash = key.lastIndexOf('/');
            key = key.substr(lastSlash + 1);

            /* If the key has a js file extension, get rid of it */
            if (key.indexOf('.js', key.length - 3) !== -1) {
                key = key.substr(0, key.length - 3);
            }

            key = lcFirst(key);

            if(typeof _values[key] !== 'undefined'){
                // TODO: error
            }

            _shared[key] = !!shared;
            _intact[key] = !!intact;

            /* String definitions are assumed to be file paths
             * The file will be required and invoked if it is a function */
            if (typeof definition === 'string' && !_intact[key]) {
                if (definition[0] === '.') {
                    definition = path.resolve(_config.basePath, definition);
                }
                definition = (def => () => this.invoke(require(def))).call(null, definition);
            }

            _values[key] = definition;

            return this;
        }

        service(key, definition) {
            return this.register(key, definition, true);
        }

        intact(key, definition) {
            return this.register(key, definition, false, true);
        }

        setter(setterName) {
            _setters.push(setterName);
            return this;
        }

        alias(key, aliasedKey) {
            this.service(key, () => this.get(aliasedKey));
        }

    }

    if (module != null) {
        module.exports = Container;
    } else {
        this.Container = Container;
    }

}).call(null);