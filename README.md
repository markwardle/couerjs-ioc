# Couer IoC

This is a simple inversion of control container.

## Creating the container

```javascript

var pathToRelativeIncludes = './lib'
var container = require('couer-container').create(pathToRelativeIncludes);

```

## Registering dependencies



### Lazily loading modules

A dependency is usually registered with a key and a value.  However,
if only one string argument is provided, it will be used as both the 
key and the value and the key will be normalized into a shorter key.

A key that is a string is recognized as a module name that will be
required when it is retrieved from the container.  Essentially, it is
the same as registering the already required module, except that the
module will not be required until it is used.

```javascript
container.register('fs');
container.register('_', 'lodash');
container.register('./path/to/my/customModule');

container.get('fs');            // node fs module
container.get('_');             // lodash
container.get('customModule');  // your custom module loaded and ready to go
```

### Registering factories

A registered function is treated as a factory which will be invoked when the
value is retrieved from the container.

```javascript
var factory = function() {
    var someModule = require('./some/module');
    someModule.someProperty = 'hello';
}

container.register('someModule', factory);
var someModule = container.get('someModule');
console.log(someModule.someProperty);          // 'hello'
```

If the factory function has parameters, they will be injected.

### Registering arbitrary values

You can register arbitrary values with the container.

```javascript
container.register('number', 1);
container.register('fruit', {'apple', 'banana'});
```

However, functions and strings are treated specially, so they
can not be registered as arbitrary values using the register method.
Instead, use the intact method.

```javascript
var sayIt = function(saying) {
    console.log(saying);
}

container.intact('saying', 'hello');
container.intact('sayIt', sayIt);
 
container.get('sayIt').call(null, container.get('saying')); // 'hello'
```




