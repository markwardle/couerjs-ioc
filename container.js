'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

(function () {
    var path = require('path');
    var argsList = require('args-list');

    var _values = {};
    var _intact = {};
    var _shared = {};
    var _setters = [];
    var _config = {
        basePath: './'
    };

    function lcFirst(str) {
        return str[0].toLowerCase() + str.slice(1);
    }

    var Container = (function () {
        function Container(config) {
            _classCallCheck(this, Container);

            _config.basePath = config.basePath || './';
        }

        _createClass(Container, [{
            key: 'get',
            value: function get(key) {
                var args = arguments[1] === undefined ? {} : arguments[1];

                /* The key has to be a string */
                if (typeof key !== 'string') {
                    return undefined;
                }

                /* Functions are factories unless otherwise specified */
                if (typeof _values[key] === 'function' && !_intact[key]) {
                    var result = this.invoke(_values[key], args);

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
        }, {
            key: 'resolveArguments',
            value: function resolveArguments(func, args) {
                var _this = this;

                return argsList(func).map(function (argName) {
                    return typeof args[argName] !== 'undefined' ? args[argName] : _this.get(argName);
                });
            }
        }, {
            key: 'invoke',
            value: function invoke(func) {
                var _this2 = this;

                var args = arguments[1] === undefined ? {} : arguments[1];

                /* Make sure we are dealing with a function */
                if (typeof func !== 'function') {
                    return func;
                }

                /* Create a this argument in case the function is a constructor */
                var thisArg = Object.create(func.prototype);

                /* Determine what arguments will be applied to the function */
                var resolved = this.resolveArguments(func, args);

                /* If the invocation returns a value, use that, otherwise return the this argument */
                var result = func.apply(thisArg, resolved) || thisArg;

                /* Apply setters */
                if (typeof result === 'object') {
                    _setters.forEach(function (setter) {
                        if (typeof result[setter] === 'function') {
                            result[setter].apply(result, _this2.resolveArguments(result[setter], args));
                        }

                        // TODO: should setters work on properties?
                    });
                }

                return result;
            }
        }, {
            key: 'register',
            value: function register(key, definition) {
                var _this3 = this;

                var shared = arguments[2] === undefined ? false : arguments[2];
                var intact = arguments[3] === undefined ? false : arguments[3];

                /* The key has to be a string */
                if (typeof key !== 'string') {
                    return;
                }

                /* The definition parameter is optional */
                if (typeof definition === 'undefined') {
                    definition = key;
                }

                /* A relative path */
                var lastSlash = key.lastIndexOf('/');
                key = key.substr(lastSlash + 1);

                /* If the key has a js file extension, get rid of it */
                if (key.indexOf('.js', key.length - 3) !== -1) {
                    key = key.substr(0, key.length - 3);
                }

                key = lcFirst(key);

                if (typeof _values[key] !== 'undefined') {}

                _shared[key] = !!shared;
                _intact[key] = !!intact;

                /* String definitions are assumed to be file paths
                 * The file will be required and invoked if it is a function */
                if (typeof definition === 'string' && !_intact[key]) {
                    if (definition[0] === '.') {
                        definition = path.resolve(_config.basePath, definition);
                    }
                    definition = (function (def) {
                        return function () {
                            return _this3.invoke(require(def));
                        };
                    }).call(null, definition);
                }

                _values[key] = definition;

                return this;
            }
        }, {
            key: 'service',
            value: function service(key, definition) {
                return this.register(key, definition, true);
            }
        }, {
            key: 'intact',
            value: function intact(key, definition) {
                return this.register(key, definition, false, true);
            }
        }, {
            key: 'setter',
            value: function setter(setterName) {
                _setters.push(setterName);
                return this;
            }
        }, {
            key: 'alias',
            value: function alias(key, aliasedKey) {
                var _this4 = this;

                this.service(key, function () {
                    return _this4.get(aliasedKey);
                });
            }
        }]);

        return Container;
    })();

    if (module != null) {
        module.exports = Container;
    } else {
        this.Container = Container;
    }
}).call(null);

// TODO: error