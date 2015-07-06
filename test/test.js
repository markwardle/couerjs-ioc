var assert = require('assert');
var ioc = require('../lib/container.js');

function FakeConsole() {
    this.logs = [];
}

FakeConsole.prototype = {
    log: function(message) {this.logs.push(message)},
    clear: function(){ this.logs = [] }
};


describe('Container', function(){
    describe('#register', function(){

    });

    describe('#invoke', function(){
        it('should allow functions to be invoked with arguments', function(){

            var fakeConsole = new FakeConsole();
            var container = ioc.create(__dirname);

            var testFunc1 = function(console, message) {
                console.log(message);
                return message;
            };

            container.register("console", fakeConsole);

            var result = container.invoke(testFunc1, {message: "test1"});

            assert.equal(fakeConsole.logs.length, 1);
            assert.equal(fakeConsole.logs[0], "test1");
            assert.equal(result, "test1");
        });
    });

    describe("#resolve", function(){
        it('should use the container to resolve arguments', function(){
            var fakeConsole = new FakeConsole();
            var container = ioc.create(__dirname);

            container.register("console", fakeConsole);
            container.register('testDependency', "./mock/TestDependency");

            var resolved = container.resolve(require('./mock/TestDependency'));

            assert.equal(Array.isArray(resolved), true);
            assert.equal(resolved.length, 1);
            assert.equal(resolved[0], fakeConsole);

            resolved = container.resolve(require('./mock/TestObject'));
            assert.equal(Array.isArray(resolved), true);
            assert.equal(resolved.length, 2);
            assert.notEqual(typeof resolved[1], 'undefined');

        })
    });

    describe("#get", function(){
        it('should resolve relative filepaths and load modules', function(){
            var fakeConsole = new FakeConsole();
            var container = ioc.create(__dirname);

            container.register("console", fakeConsole);
            container.register('testObject', "./mock/TestObject");
            container.register('testDependency', "./mock/TestDependency");

            assert.notEqual(typeof container._definitions['testObject'], 'undefined');
            assert.notEqual(typeof container._definitions['testDependency'], 'undefined');

            var obj = container.get("testObject");

            assert.notEqual(typeof obj, 'undefined');
            assert.equal(typeof obj, 'object');
            assert.equal(obj.test, null);
            assert.equal(typeof obj.test, 'object');
            assert.notEqual(typeof obj.dependency, 'undefined');
            assert.equal(obj.dependency.test, 'test');
            assert.equal(fakeConsole.logs.length, 2);
            assert.equal(fakeConsole.logs[0], 'test dependency');
            assert.equal(fakeConsole.logs[1], 'test object');
        });
    });

    describe("#intact", function(){
        it('should prevent functions from being invoked', function() {
            var fakeConsole = new FakeConsole();
            var container = ioc.create(__dirname);

            var testFunc1 = function(console, message) {
                console.log(message);
            };

            container.register("console", fakeConsole);
            container.intact("testFunc", testFunc1);

            var result = container.get("testFunc", {message: "test1"});

            assert.equal(fakeConsole.logs.length, 0);
            assert.equal(result, testFunc1);
        });

        it('should prevent strings from being treated as module names', function() {
            var container = ioc.create(__dirname);

            var testString = "./mock/TestObject";
            container.intact("testString", testString);

            var result = container.get("testString");

            assert.equal(typeof result, "string");
            assert.equal(result, testString);
        });
    });

    describe("#singleton", function(){
         it('should always return the same object', function(){
             var fakeConsole = new FakeConsole();
             var container = ioc.create(__dirname);

             container.register("console", fakeConsole);
             container.register('notShared', "./mock/TestObject");
             container.singleton('shared', "./mock/TestObject");
             container.register('testDependency', "./mock/TestDependency");

             var notShared1 = container.get("notShared");
             var notShared2 = container.get("notShared");

             assert.notEqual(notShared1, notShared2);

             var shared1 = container.get("shared");
             var shared2 = container.get("shared");

             assert.equal(shared1, shared2);

         })
    });

    describe("#alias", function(){
        it('should reference one key with another', function(){
            var fakeConsole = new FakeConsole();
            var container = ioc.create(__dirname);

            container.register("console", fakeConsole);
            container.alias("out", "console");

            assert.equal(container._aliases['out'], 'console');

            var result = container.get("out");
            assert.equal(result, fakeConsole);
        });

        it('should resolve within latest scoped container', function() {
            var badConsole = {};
            var fakeConsole = new FakeConsole();

            var container = ioc.create(__dirname);
            container.register('console', badConsole);

            var scopedContainer = container.scope();
            scopedContainer.register('console', fakeConsole);

            container.alias('out', 'console');

            var result = container.get('out');

            assert.equal(result, badConsole);
            assert.notEqual(result, fakeConsole);

            result = scopedContainer.get('out');

            assert.equal(result, fakeConsole);
        });
    });

    describe("#inflector", function(){
        it('should register a setter injector', function(){
            var fakeConsole = new FakeConsole();
            var container = ioc.create(__dirname);

            container.register("console", fakeConsole);
            container.register('testObject', "./mock/TestObject");
            container.register('testDependency', "./mock/TestDependency");
            container.intact("test", "success");

            container.inflector("testSetter");

            var obj = container.get("testObject");
            assert.equal(obj.test, "success");
        });

        it('should register a property injector', function(){
            var fakeConsole = new FakeConsole();
            var container = ioc.create(__dirname);

            container.register("console", fakeConsole);
            container.register('testObject', "./mock/TestObject");
            container.register('testDependency', "./mock/TestDependency");
            container.intact("test", "success");

            container.inflector("test");

            var obj = container.get("testObject");
            assert.equal(obj.test, "success");
        });
    });

    describe("#prepare", function(){
        it("should partially apply a function with the container", function(){
            var fakeConsole = new FakeConsole();
            var container = ioc.create(__dirname);

            var testFunc = function(out, saying) {
                out.log(saying);
            };

            container.register('console', fakeConsole);
            var prepared = container.prepare('console', testFunc);

            prepared('ok');

            assert.equal(fakeConsole.logs.length, 1);
            assert.equal(fakeConsole.logs[0], "ok");
        });

        it("should allow for passed arguments", function() {
            testFunc = function(saying, out) {
                out.log(saying);
            };

            var fakeConsole = new FakeConsole();
            var container = ioc.create(__dirname);
            container.register('console', fakeConsole);

            var prepared = container.prepare(' ,   console  ', testFunc);

            assert.equal(fakeConsole.logs.length, 0);

            prepared('ok');

            assert.equal(fakeConsole.logs.length, 1);
            assert.equal(fakeConsole.logs[0], "ok");
        });

        it('should accept an array as its keys argument', function(){
            var fakeConsole = new FakeConsole();
            var container = ioc.create(__dirname);

            container.register('console', fakeConsole);

            var testFunc = function(saying, out) {
                out.log(saying);
            };

            var prepared = container.prepare(['', 'console'], testFunc);

            prepared('ok');

            assert.equal(fakeConsole.logs.length, 1);
            assert.equal(fakeConsole.logs[0], "ok");
        });

        it('should default to using all the parameters', function(){
            var fakeConsole = new FakeConsole();
            var container = ioc.create(__dirname);

            var testFunc = function(console, saying) {
                console.log(saying);
            };

            container.intact('saying', 'ok');
            container.register('console', fakeConsole);

            var prepared = container.prepare(testFunc);
            prepared();

            assert.equal(fakeConsole.logs.length, 1);
            assert.equal(fakeConsole.logs[0], 'ok');

        });
    });

    describe('scope', function(){
        it('should create a scope not available to its parent', function() {
            var fakeConsole = new FakeConsole();
            var container = ioc.create(__dirname);

            var scoped = container.scope();
            scoped.register('console', fakeConsole);

            assert.equal(container.has('console'), false);
            assert.equal(typeof (container.get('console')), 'undefined');

            assert.equal(scoped.has('console'), true);
            assert.equal(scoped.get('console'), fakeConsole);
        });

        it('should create a container that still has access to its parent', function(){
            var fakeConsole = new FakeConsole();
            var container = ioc.create(__dirname);

            var scoped = container.scope();
            container.register('console', fakeConsole);

            assert.equal(container.has('console'), true);
            assert.equal(container.get('console'), fakeConsole);

            assert.equal(scoped.has('console'), true);
            assert.equal(scoped.get('console'), fakeConsole);
        });
    });

    describe('sub', function(){
        it('should create a sub container that is unaware of its parent', function(){
            var fakeConsole = new FakeConsole();
            var container = ioc.create(__dirname);
            container.register('console', fakeConsole);

            var sub = container.sub();

            assert.equal(container.has('console'), true);
            assert.equal(container.get('console'), fakeConsole);

            assert.equal(sub.has('console'), false);
            assert.equal(typeof (sub.get('console')), 'undefined');

        });

        it('should create a sub container whose items are available to its parent', function(){
            var fakeConsole = new FakeConsole();
            var container = ioc.create(__dirname);

            var sub = container.sub();
            sub.register('console', fakeConsole);

            assert.equal(container.has('console'), true);
            assert.equal(container.get('console'), fakeConsole);

            assert.equal(sub.has('console'), true);
            assert.equal(sub.get('console'), fakeConsole);
        });
    });

});