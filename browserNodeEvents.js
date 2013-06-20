//Very slightly modified version of Node's event emitter - should have same interface

//Because they're unavailable:
//
//Pulled domains and module stuff out.
//Replaced TypeError calls with generic 'new Error' calls

//Because I'm anal about my own style prefs:
//
//Encapsulated instance vars and set public methods to interior of constructor rather than every last one on prototype
//Used func hoisting in constructor to declare the public interface in a compact manner
//Named all funcs - also helpful for Chrome debug

//Because memory leaks in browsers get really obvious really fast and I don't like solving problems I didn't have  yet:
//
//defaulted max listeners to 0 (unlimited)

function EventEmitter() {
    
    var
        _events = {},
        _maxListeners = 0;
    
    this.setMaxListeners = setMaxListeners;
    
    this.emit = emit;
    
    this.addListener = this.on = addListener;
    this.once = once;
    
    this.removeListener = removeListener;
    this.removeAllListeners = removeAllListeners;
    
    this.listeners = listeners; 
    
    
    function setMaxListeners(n) {
        if (typeof n !== 'number' || n < 0)
            throw new Error('n must be a positive number');
        _maxListeners = n;
    }
    
    function emit(type) {
      var er, handler, len, args, i, listeners;

      if (!_events)
        _events = {};

      // If there is no 'error' event listener then throw.
      if (type === 'error') {
        if (!_events.error ||
            (typeof _events.error === 'object' &&
             !_events.error.length)) {
          er = arguments[1];
          if (this.domain) {
            if (!er) er = new new Error('Uncaught, unspecified "error" event.');
            er.domainEmitter = this;
            er.domain = this.domain;
            er.domainThrown = false;
            this.domain.emit('error', er);
          } else if (er instanceof Error) {
            throw er; // Unhandled 'error' event
          } else {
            throw new Error('Uncaught, unspecified "error" event.');
          }
          return false;
        }
      }

      handler = _events[type];

      if (typeof handler === 'undefined')
        return false;

      if (typeof handler === 'function') {
        switch (arguments.length) {
          // fast cases
          case 1:
            handler.call(this);
            break;
          case 2:
            handler.call(this, arguments[1]);
            break;
          case 3:
            handler.call(this, arguments[1], arguments[2]);
            break;
          // slower
          default:
            len = arguments.length;
            args = new Array(len - 1);
            for (i = 1; i < len; i++)
              args[i - 1] = arguments[i];
            handler.apply(this, args);
        }
      } else if (typeof handler === 'object') {
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];

        listeners = handler.slice();
        len = listeners.length;
        for (i = 0; i < len; i++)
          listeners[i].apply(this, args);
      }

      return true;
    }
    
    function addListener(type, listener) {
      var m;

      if (typeof listener !== 'function')
        throw new Error('listener must be a function');

      if (!_events)
        _events = {};

      // To avoid recursion in the case that type === "newListener"! Before
      // adding it to the listeners, first emit "newListener".
      if (_events.newListener)
        this.emit('newListener', type, typeof listener.listener === 'function' ?
                  listener.listener : listener);

      if (!_events[type])
        // Optimize the case of one listener. Don't need the extra array object.
        _events[type] = listener;
      else if (typeof _events[type] === 'object')
        // If we've already got an array, just append.
        _events[type].push(listener);
      else
        // Adding the second element, need to change to array.
        _events[type] = [_events[type], listener];

      // Check for listener leak
      if (typeof _events[type] === 'object' && !_events[type].warned) {
        m = _maxListeners;
        if (m && m > 0 && _events[type].length > m) {
          _events[type].warned = true;
          console.error('(node) warning: possible EventEmitter memory ' +
                        'leak detected. %d listeners added. ' +
                        'Use emitter.setMaxListeners() to increase limit.',
                        _events[type].length);
          console.trace();
        }
      }

      return this;
    }

    function once(type, listener) {
      if (typeof listener !== 'function')
        throw new Error('listener must be a function');

      function g() {
        this.removeListener(type, g);
        listener.apply(this, arguments);
      }

      g.listener = listener;
      this.on(type, g);

      return this;
    }

    // emits a 'removeListener' event iff the listener was removed
    function removeListener(type, listener) {
      var list, position, length, i;

      if (typeof listener !== 'function')
        throw new Error('listener must be a function');

      if (!_events || !_events[type])
        return this;

      list = _events[type];
      length = list.length;
      position = -1;

      if (list === listener ||
          (typeof list.listener === 'function' && list.listener === listener)) {
        _events[type] = undefined;
        if (_events.removeListener)
          this.emit('removeListener', type, listener);

      } else if (typeof list === 'object') {
        for (i = length; i-- > 0;) {
          if (list[i] === listener ||
              (list[i].listener && list[i].listener === listener)) {
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (list.length === 1) {
          list.length = 0;
          _events[type] = undefined;
        } else {
          list.splice(position, 1);
        }

        if (_events.removeListener)
          this.emit('removeListener', type, listener);
      }

      return this;
    }

    function removeAllListeners(type) {
      var key, listeners;

      if (!_events)
        return this;

      // not listening for removeListener, no need to emit
      if (!_events.removeListener) {
        if (arguments.length === 0)
          _events = {};
        else if (_events[type])
          _events[type] = undefined;
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        for (key in _events) {
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        _events = {};
        return this;
      }

      listeners = _events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else {
        // LIFO order
        while (listeners.length)
          this.removeListener(type, listeners[listeners.length - 1]);
      }
      _events[type] = undefined;

      return this;
    }

    function listeners(type) {
      var ret;
      if (!_events || !_events[type])
        ret = [];
      else if (typeof _events[type] === 'function')
        ret = [_events[type]];
      else
        ret = _events[type].slice();
      return ret;
    }

}

//kind of a pointless 'static' method but leaving the Node stuff intact
EventEmitter.listenerCount = ( function listenerCount(emitter, type) {
    var
        ret,
        listeners = emitter.listeners;
    
    if ( !emitter.listeners || !emitter.listeners[type] )
        ret = 0;
    else if ( typeof listeners[type] === 'function' )
        ret = 1;
    else
        ret = emitter._events[type].length;
    return ret;
} );
