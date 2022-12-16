'use strict';

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _setImmediate2 = require('babel-runtime/core-js/set-immediate');

var _setImmediate3 = _interopRequireDefault(_setImmediate2);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _create = require('babel-runtime/core-js/object/create');

var _create2 = _interopRequireDefault(_create);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * gulf - Sync anything!
 * Copyright (C) 2013-2016 Marcel Klehr <mklehr@gmx.net>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
var debug = require('debug')('gulf');
var Link = require('./Link'),
    Revision = require('./Revision'),
    MemoryAdapter = require('./MemoryAdapter'),
    queue = require('queue'),
    EventEmitter = require('events').EventEmitter,
    co = require('co');

function Document(options) {
  EventEmitter.apply(this);
  this.id;
  this.options = {
    mergeQueue: true,
    storageAdapter: new MemoryAdapter()
  };
  for (var prop in options) {
    this.options[prop] = options[prop];
  }this.storage = this.options.storageAdapter;
  this.ottype = this.options.ottype;

  this.content = null;
  this.initialized = false;

  this.slaves = [];
  this.links = [];
  this.master = null;

  this.queue = queue();
  this.queue.concurrency = 1;
  this.queue.start();

  if (!this.ottype) throw new Error('Document: No ottype specified');
  if (!this.storage) throw new Error('Document: No adapter specified');
  this.on('error', console.log);
}

module.exports = Document;

Document.prototype = (0, _create2.default)(EventEmitter.prototype, { constructor: { value: Document } });

/**
 * Load an existing document
 * @returns Promise
 */
Document.prototype.initializeFromStorage = co.wrap(_regenerator2.default.mark(function _callee(defaultContent) {
  var revId, rev;
  return _regenerator2.default.wrap(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _context.prev = 0;
          _context.next = 3;
          return this.storage.getLastRevisionId();

        case 3:
          revId = _context.sent;
          _context.next = 8;
          break;

        case 6:
          _context.prev = 6;
          _context.t0 = _context['catch'](0);

        case 8:
          if (!('number' !== typeof revId)) {
            _context.next = 14;
            break;
          }

          rev = Revision.newInitial(this.ottype, defaultContent);
          _context.next = 12;
          return this.storage.storeRevision(rev);

        case 12:
          _context.next = 17;
          break;

        case 14:
          _context.next = 16;
          return this.storage.getRevision(revId);

        case 16:
          rev = _context.sent;

        case 17:
          this.initialized = true;
          this.content = rev.content;
          this.emit('init');

        case 20:
        case 'end':
          return _context.stop();
      }
    }
  }, _callee, this, [[0, 6]]);
}));

/**
 * Creates a new Link and attaches it as a slave
 * @param opts Options to be passed to Link constructor
 */
Document.prototype.slaveLink = function (opts) {
  var link = new Link(opts);
  this.attachSlaveLink(link);
  return link;
};

/**
 * Creates a new Link and attaches it as master
 * (You will want to listen to the link's 'close' event)
 * @param opts Options to be passed to Link constructor
 */
Document.prototype.masterLink = function (opts) {
  var link = new Link(opts);
  this.attachMasterLink(link);
  return link;
};

/**
 * Attaches a link as master
 */
Document.prototype.attachMasterLink = function (link) {
  var _this = this;

  this.master = link;
  this.attachLink(link);

  link.on('editError', function () {
    link.send('requestInit');
  });

  link.on('finish', function () {
    _this.master = null;
  });
};

/**
 * Attaches a link as a slave
 */
Document.prototype.attachSlaveLink = function (link) {
  var _this2 = this;

  this.slaves.push(link);
  this.attachLink(link);

  link.on('editError', function () {
    _this2.receiveRequestInit(link).catch(function (e) {
      return _this2.emit('error', e);
    });
  });

  link.on('finish', function () {
    _this2.slaves.splice(_this2.slaves.indexOf(link), 1);
  });
};

Document.prototype.attachLink = function (link) {
  var _this3 = this;

  if (~this.links.indexOf(link)) return;

  this.links.push(link);

  // Other end requests init? can do.
  link.on('link:requestInit', function () {
    _this3.receiveRequestInit(link).catch(function (e) {
      return _this3.emit('error', e);
    });
  });

  // Other side sends init.
  link.on('link:init', function (data) {
    _this3.receiveInit(data, link).catch(function (e) {
      return _this3.emit('error', e);
    });
  });

  link.on('link:requestHistorySince', function (since) {
    _this3.receiveRequestHistorySince(since, link).catch(function (e) {
      return _this3.emit('error', e);
    });
  });

  // Other side sends edit.
  link.on('link:edit', function (edit) {
    _this3.receiveEdit(edit, link.authenticated, link).catch(function (e) {
      return _this3.emit('error', e);
    });
  });

  link.on('finish', function () {
    _this3.detachLink(link);
  });

  // If we don't know the document yet, request its content
  if (null === this.content) link.send('requestInit');
};

Document.prototype.detachLink = function (link) {
  var idx;
  if (!~(idx = this.links.indexOf(link))) return;
  this.links.splice(idx, 1);
  link.reset();
};

Document.prototype.close = function () {
  this.links.forEach(function (l) {
    l.reset();
  });
  this.links = [];
  this.master = null;
  this.slaves = [];
};

Document.prototype.receiveRequestInit = co.wrap(_regenerator2.default.mark(function _callee2(link) {
  var _this4 = this;

  var latestId, latest;
  return _regenerator2.default.wrap(function _callee2$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          debug('receiveRequestInit');

          if (this.initialized) {
            _context2.next = 4;
            break;
          }

          _context2.next = 4;
          return function (cb) {
            return _this4.once('init', cb);
          };

        case 4:
          _context2.next = 6;
          return this.storage.getLastRevisionId();

        case 6:
          latestId = _context2.sent;
          _context2.next = 9;
          return this.storage.getRevision(latestId);

        case 9:
          latest = _context2.sent;


          link.send('init', latest); // We skip toJSON(fromJSON(x))

        case 11:
        case 'end':
          return _context2.stop();
      }
    }
  }, _callee2, this);
}));

/**
 * Receive init
 *
 * @param data {Object} (Serialized Revision with content)
 * @param fromLink
 */
Document.prototype.receiveInit = co.wrap(_regenerator2.default.mark(function _callee3(data, fromLink) {
  var initialRev;
  return _regenerator2.default.wrap(function _callee3$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          debug('receiveInit', data);
          // I'm master? Don't go bossing me around!

          if (!(!this.master || fromLink !== this.master)) {
            _context3.next = 3;
            break;
          }

          return _context3.abrupt('return');

        case 3:
          initialRev = Revision.fromJSON(data, this.ottype);


          this.links.forEach(function (link) {
            return link.reset();
          });
          this.content = initialRev.content;

          _context3.next = 8;
          return this.storage.storeRevision(initialRev.toJSON(true));

        case 8:

          // I got an init, so my slaves get one, too
          this.slaves.forEach(function (slave) {
            slave.send('init', data);
          });

          this.initialized = true;
          this.emit('init');

        case 11:
        case 'end':
          return _context3.stop();
      }
    }
  }, _callee3, this);
}));

/**
 * Receive a requestHistorySince message
 *
 * @param sinceEditId String The last known edit id by the slave
 * @param fromLink
 */
Document.prototype.receiveRequestHistorySince = co.wrap(_regenerator2.default.mark(function _callee4(sinceEditId, fromLink) {
  var _this5 = this;

  return _regenerator2.default.wrap(function _callee4$(_context4) {
    while (1) {
      switch (_context4.prev = _context4.next) {
        case 0:
          _context4.next = 2;
          return this.getRevisionsAfter(sinceEditId);

        case 2:
          _context4.t0 = _context4.sent;

          _context4.t1 = function (r) {
            return Revision.fromJSON(r, _this5.ottype);
          };

          _context4.t2 = function (rev) {
            return fromLink.sendEdit(rev);
          };

          fromLink.reset()(_context4.t0).map(_context4.t1).forEach(_context4.t2);

        case 6:
        case 'end':
          return _context4.stop();
      }
    }
  }, _callee4, this);
}));

/**
 * Get all revisions after x
 * @param x the id of the edit after which edits are collected
 * @returns Promise<Array<Revision>>
 */
Document.prototype.getRevisionsAfter = co.wrap(_regenerator2.default.mark(function _callee5(afterId) {
  var _this6 = this;

  var lastId, requestIds, i;
  return _regenerator2.default.wrap(function _callee5$(_context5) {
    while (1) {
      switch (_context5.prev = _context5.next) {
        case 0:
          _context5.next = 2;
          return this.storage.getLastRevisionId();

        case 2:
          lastId = _context5.sent;
          requestIds = [];

          for (i = afterId + 1; i <= lastId; i++) {
            requestIds.push(i);
          }_context5.next = 7;
          return requestIds.map(function (id) {
            return _this6.storage.getRevision(id);
          });

        case 7:
          _context5.t0 = function (rev) {
            return Revision.fromJSON(rev, _this6.ottype);
          };

          return _context5.abrupt('return', _context5.sent.map(_context5.t0));

        case 9:
        case 'end':
          return _context5.stop();
      }
    }
  }, _callee5, this);
}));

/**
 * Receive an edit
 *
 * @param edit <Edit>
 * @paramfromLink <Link>
 */
Document.prototype.receiveEdit = co.wrap(_regenerator2.default.mark(function _callee6(edit, author, fromLink) {
  var _this7 = this;

  var queueCb;
  return _regenerator2.default.wrap(function _callee6$(_context6) {
    while (1) {
      switch (_context6.prev = _context6.next) {
        case 0:
          debug('receiveEdit', edit);

          edit = Revision.fromJSON(edit, this.ottype);
          edit.author = author;

          if (!(this.master && fromLink !== this.master)) {
            _context6.next = 6;
            break;
          }

          _context6.next = 6;
          return this.master.sendEdit(edit);

        case 6:
          _context6.next = 8;
          return function (resolve) {
            _this7.queue.push(function (cb) {
              return resolve(null, cb);
            });
            _this7.queue.start();
          };

        case 8:
          queueCb = _context6.sent;
          _context6.prev = 9;
          _context6.next = 12;
          return this.dispatchEdit(edit, fromLink);

        case 12:
          _context6.next = 17;
          break;

        case 14:
          _context6.prev = 14;
          _context6.t0 = _context6['catch'](9);

          this.emit('error', _context6.t0);

        case 17:
          queueCb();

        case 18:
        case 'end':
          return _context6.stop();
      }
    }
  }, _callee6, this, [[9, 14]]);
}));

/**
 * Dispatch a received edit
 *
 * @param edit <Edit>
 * @param fromLink <Link> (optional>
 */
Document.prototype.dispatchEdit = co.wrap(_regenerator2.default.mark(function _callee7(edit, fromLink) {
  var _this8 = this;

  var lastRevId;
  return _regenerator2.default.wrap(function _callee7$(_context7) {
    while (1) {
      switch (_context7.prev = _context7.next) {
        case 0:
          if (!(fromLink && fromLink.sentEdit && fromLink.sentEdit.id === edit.id)) {
            _context7.next = 5;
            break;
          }

          fromLink.sentEdit.callback(null, fromLink.sentEdit);
          fromLink.sentEdit = null;
          (0, _setImmediate3.default)(function () {
            fromLink._read(0);
          });
          return _context7.abrupt('return');

        case 5:
          if (this.initialized) {
            _context7.next = 8;
            break;
          }

          _context7.next = 8;
          return function (cb) {
            return _this8.once('init', function () {
              return cb();
            });
          };

        case 8:
          _context7.next = 10;
          return this.storage.getLastRevisionId();

        case 10:
          lastRevId = _context7.sent;

          if (!(edit.parent > lastRevId)) {
            _context7.next = 19;
            break;
          }

          if (!(fromLink === this.master)) {
            _context7.next = 17;
            break;
          }

          // we probably missed some edits, let's ask master!
          this.master.send('requestHistorySince', lastRevId);
          return _context7.abrupt('return');

        case 17:
          // I'm master, I can't have missed that edit. So, throw and re-init!
          fromLink && fromLink.emit('editError', new Error('Edit "' + edit.id + '" has unknown parent "' + edit.parent + '"'));
          return _context7.abrupt('return');

        case 19:
          _context7.prev = 19;
          _context7.next = 22;
          return this.sanitizeEdit(edit, fromLink);

        case 22:
          _context7.next = 24;
          return this.applyEdit(edit, /*ownEdit*/false);

        case 24:
          _context7.next = 30;
          break;

        case 26:
          _context7.prev = 26;
          _context7.t0 = _context7['catch'](19);

          fromLink && fromLink.emit('editError', _context7.t0);
          return _context7.abrupt('return');

        case 30:

          // add to history
          edit.id = lastRevId + 1;
          edit.content = this.content;
          _context7.next = 34;
          return this.storage.storeRevision(edit.toJSON(true));

        case 34:

          // If I'm master then we need to queue the ack
          // Slaves have to send it straight away
          if (fromLink === this.master) fromLink.send('ack', edit.id);else if (fromLink) fromLink.sendAck(edit.id);

          this.distributeEdit(edit, fromLink);
          this.emit('commit', edit, /*ownEdit:*/false);

        case 37:
        case 'end':
          return _context7.stop();
      }
    }
  }, _callee7, this, [[19, 26]]);
}));

/**
 * Returns an edit that is able to be applied
 */
Document.prototype.sanitizeEdit = co.wrap(_regenerator2.default.mark(function _callee8(edit, fromLink, cb) {
  var missed;
  return _regenerator2.default.wrap(function _callee8$(_context8) {
    while (1) {
      switch (_context8.prev = _context8.next) {
        case 0:
          if (!(this.master === fromLink)) {
            _context8.next = 4;
            break;
          }

          return _context8.abrupt('return');

        case 4:
          _context8.next = 6;
          return this.getRevisionsAfter(edit.parent);

        case 6:
          missed = _context8.sent;


          missed.forEach(function (oldRev) {
            try {
              debug('sanitize', 'transform', edit, oldRev);
              edit.follow(oldRev);
            } catch (e) {
              e.message = 'Transforming edit against ' + oldRev.id + ' failed: ' + e.message;
              throw e;
            }
          });

          if (missed.length > 10) {
            // this one apparently missed a lot of edits, looks like this is a reconnect
            // -> send 'em our stash
            missed.forEach(function (oldRev) {
              fromLink.send('edit', oldRev);
            });
          }

        case 9:
        case 'end':
          return _context8.stop();
      }
    }
  }, _callee8, this);
}));

Document.prototype.applyEdit = function (edit, ownEdit) {
  // apply changes
  debug('Document: apply edit', edit);
  try {
    this.content = edit.apply(this.content);
    return _promise2.default.resolve();
  } catch (e) {
    e.message = 'Applying edit failed: ' + e.message;
    return _promise2.default.reject(e);
  }
};

Document.prototype.distributeEdit = function (edit, fromLink) {
  var _this9 = this;

  // forward edit
  this.links.forEach(function (link) {
    if (link === fromLink) return;
    if (link === _this9.master) return;

    link.sendEdit(edit);
  });
};