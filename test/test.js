var assert = require('assert');
var Container = require('../container.js');

function FakeConsole() {
    this.logs = [];
}

FakeConsole.prototype = {
    log: function(message) {this.logs.push(message)},
    clear: function(){ this.logs = [] }
};

describe('Container', function(){
    describe('#invoke', function(){
        it('should allow functions to be invoked with arguments', function(){

            var fakeConsole = new FakeConsole();
            var container = new Container({basePath: __dirname});

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

    describe("#get", function(){
        it('should resolve relative filepaths and load modules', function(){
            var fakeConsole = new FakeConsole();
            var container = new Container({basePath: __dirname});

            container.register("console", fakeConsole);
            container.register("./mock/TestObject");
            container.register("./mock/TestDependency");

            var obj = container.get("testObject");

            assert.notEqual(typeof obj, 'undefined');
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
            var container = new Container({basePath: __dirname});

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
            var container = new Container({basePath: __dirname});

            var testString = "./mock/TestObject";
            container.intact("testString", testString);

            var result = container.get("testString");

            assert.equal(typeof result, "string");
            assert.equal(result, testString);
        });
    });

    describe("#service", function(){
         it('should always return the same object', function(){
             var fakeConsole = new FakeConsole();
             var container = new Container({basePath: __dirname});

             container.register("console", fakeConsole);
             container.register('notShared', "./mock/TestObject");
             container.service('shared', "./mock/TestObject");
             container.register("./mock/TestDependency");

             var notShared1 = container.get("notShared");
             var notShared2 = container.get("notShared");

             assert.notEqual(notShared1, notShared2);

             var shared1 = container.get("shared");
             var shared2 = container.get("shared");

             assert.equal(shared1, shared2);

         })
    });

    describe("#alias", function(){
        it('should reference once key with another', function(){
            var fakeConsole = new FakeConsole();
            var container = new Container({basePath: __dirname});

            container.register("console", fakeConsole);
            container.alias("out", "console");

            var result = container.get("out");
            assert.equal(result, fakeConsole);
        });
    });

    describe("#setter", function(){
        it('should register a setter injector', function(){
            var fakeConsole = new FakeConsole();
            var container = new Container({basePath: __dirname});

            container.register("console", fakeConsole);
            container.register("./mock/TestObject");
            container.register("./mock/TestDependency");
            container.intact("test", "success");

            container.setter("testSetter");

            var obj = container.get("testObject");
            assert.equal(obj.test, "success");
        });
    })

});