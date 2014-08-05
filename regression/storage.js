/**
 * Copyright 2014 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*global describe, it, before, after */

'use strict';

var assert = require('assert');
var async = require('async');
var crypto = require('crypto');
var fs = require('fs');
var tmp = require('tmp');

var env = require('./env.js');
var gcloud = require('../lib');

var bucket = new gcloud.storage.Bucket(env);

var pathToLogoFile = 'regression/data/CloudPlatform_128px_Retina.png';
var logoFileMd5Hash;

describe('storage', function() {
  describe('write, read and remove files', function() {
    before(function(done) {
      var md5sum = crypto.createHash('md5');
      var s = fs.ReadStream(pathToLogoFile);
      s.on('data', function(d) {
        md5sum.update(d);
      });
      s.on('error', done);
      s.on('end', function() {
        logoFileMd5Hash = md5sum.digest('base64');
        done();
      });
    });

    it('should write/remove from file', function(done) {
      var fileName = 'CloudLogo';
      var fileConfig = { filename: pathToLogoFile };
      bucket.write(fileName, fileConfig, function(err, fileObject) {
        assert.ifError(err);
        assert.equal(fileObject.md5Hash, logoFileMd5Hash);
        bucket.remove(fileName, done);
      });
    });

    it('should write/remove from stream', function(done) {
      var fileName = 'CloudLogo';
      var fileConfig = { data: fs.createReadStream(pathToLogoFile) };
      bucket.write(fileName, fileConfig, function(err, fileObject) {
        assert.ifError(err);
        assert.equal(fileObject.md5Hash, logoFileMd5Hash);
        bucket.remove(fileName, function(err) {
          assert.ifError(err);
          done();
        });
      });
    });

    it('should write/read/remove from a buffer', function(done) {
      var fileName = 'MyBuffer';
      var fileContent =  'Hello World';
      tmp.setGracefulCleanup();
      tmp.file(function _tempFileCreated(err, path) {
        assert.ifError(err);
        bucket.write(
            fileName, { data: fileContent }, function(err, fileObject) {
          assert.ifError(err);
          assert(fileObject);
          bucket.createReadStream(fileName)
              .pipe(fs.createWriteStream(path))
              .on('error', done)
              .on('complete', function() {
                bucket.remove(fileName, function(err) {
                  assert.ifError(err);
                  fs.readFile(path, function(err, data) {
                    assert.equal(data, fileContent);
                    done();
                  });
                });
              });
        });
      });
    });

    it('should write and read metadata', function(done) {
      var fileName = 'CloudLogo';
      var myMetadata = { contentType: 'image/png' };
      var fileConfig = { filename: pathToLogoFile, metadata: myMetadata };
      bucket.write(fileName, fileConfig, function(err) {
        assert.ifError(err);
        bucket.stat(fileName, function(err, metadata) {
          assert.ifError(err);
          assert.equal(metadata.contentType, myMetadata.contentType);
          bucket.remove(fileName, function(err) {
            assert.ifError(err);
            done();
          });
        });
      });
    });

    it('should copy an existing file', function(done) {
      var fileName = 'CloudLogo';
      var fileConfig = { filename: pathToLogoFile };
      var copyName = 'CloudLogoCopy';

      // TODO(silvano): Use async.parallel.
      bucket.write(fileName, fileConfig, function(err) {
        assert.ifError(err);
        bucket.copy(fileName, { name: copyName }, function() {
          assert.ifError(err);
          bucket.remove(copyName, function(err) {
            assert.ifError(err);
            bucket.remove(fileName, function(err) {
              assert.ifError(err);
              done();
            });
          });
        });
      });
    });
  });

  describe('list files', function() {
    var filenames = ['CloudLogo1', 'CloudLogo2', 'CloudLogo3'];
    var fileConfig = { filename: pathToLogoFile };

    before(function(done) {
      bucket.write(filenames[0], fileConfig, function(err) {
        assert.ifError(err);
        bucket.copy(filenames[0], { name: filenames[1] }, function() {
          assert.ifError(err);
          bucket.copy(filenames[0], { name: filenames[2] }, function() {
            assert.ifError(err);
            done();
          });
        });
      });
    });

    it('should list files', function(done) {
      bucket.list(function(err, files, nextQuery) {
        assert.ifError(err);
        assert.equal(files.length, 3);
        assert.equal(nextQuery, null);
        done();
      });
    });

    it('should paginate the list', function(done) {
      bucket.list({ maxResults: 2 }, function(err, files, nextQuery) {
        assert.ifError(err);
        assert.equal(files.length, 2);
        assert(nextQuery);
        bucket.list(nextQuery, function(err, files) {
          assert.ifError(err);
          assert(files);
          done();
        });
      });
    });

    after(function(done) {
      // TODO(silvano): Use Array.prototype.map to generate task array.
      async.parallel([
        function(callback) {
          bucket.remove(filenames[0], callback);
        },
        function(callback) {
          bucket.remove(filenames[1], callback);
        },
        function(callback) {
          bucket.remove(filenames[2], callback);
        }
      ], done);
    });
  });
});
