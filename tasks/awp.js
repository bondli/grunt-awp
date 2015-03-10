/*
 * grunt-awp
 * https://github.com/bondli/grunt-awp
 *
 * Copyright (c) 2015 pixi
 * Licensed under the MIT license.
 */

'use strict';

var fs = require('fs');
var path = require('path');
var http = require('http');

var inquirer = require('inquirer');
var clc = require('cli-color'); // required by inquirer
var success = clc.green;
var error = clc.red.bold;
var warn = clc.yellow;
var notice = clc.blue;

var fstools = require('fs-tools');
var request = require('request');
var Q = require('q');
var crypto = require('crypto');
var moment = require('moment');
require('shelljs/global');

moment.locale('zh-cn');

var md5 = function(text) {
  return crypto.createHash('md5').update(text, 'utf8').digest('hex');
};


// Home 目录路径
var userHome = process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH; //兼容windows
var AWP_CONFIG_FILE_PATH = userHome + '/awp-grunt.json';

var DEFAULT_PUB_DIR = 'htmls-dist/';

module.exports = function(grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

  grunt.registerMultiTask('awp', 'publish htmls to awp', function() {

    var checkDone = this.async();
    
    var options = this.options();

    //console.log(JSON.stringify(options), JSON.stringify(this.files));
    //return;
    
    var awpConfig = options.awpConfig,
        pubConfig = {
          env : options.env,
          files : this.files[0].src
        };

    //检查是否设置了ID和目录
    if (!awpConfig.dWebappId || !awpConfig.oWebappId || !awpConfig.oWebappDir) {
      console.log(error('请先在gruntfile配置项目的对应的awp应用id和目录'));
      process.exit(0);
    }
    

    try {
        var userConfig = require(AWP_CONFIG_FILE_PATH);

        awpConfig.cname = userConfig.cname;
        awpConfig.dToken = userConfig.dToken;
        awpConfig.oToken = userConfig.oToken;

    } catch(e) {
        console.log(error('请先在['+AWP_CONFIG_FILE_PATH+']文件中配置用户信息。'));
        process.exit(0);
    }

    cd(DEFAULT_PUB_DIR);

    if(pubConfig.env == 'daily') {
      console.log('您正在执行同步awp daily 操作……');
    }

    if(pubConfig.env == 'prepub') {
      console.log('您正在执行awp 预发 操作……');
    }

    if(pubConfig.env == 'onlinepre') {
      console.log('您正在执行awp 线上预览 操作……');
    }

    if(pubConfig.env == 'online') {
      console.log('您正在执行awp 上线 操作……'); 
    }

    //检查CDN资源是否已经发布
    if(pubConfig.env == 'online') {
      var checkPromise = checkAssetsPublished();
      checkPromise.then(function(){
        getPublishFile(pubConfig.files);
      });
    }
    else{
      getPublishFile(pubConfig.files);
    }


    /**
     * 获取需要发布的文件
     * @return {[type]} [description]
     */
    function getPublishFile(selectedFile) {
        console.log('你需要发布文件如下：');
        
        var files = [];
        selectedFile.forEach(function(file, idx) {
            console.log('  [' + (idx + 1) + ']' + file);
            files.push(file);
        });
        
        prepareBatchPubFiles(awpConfig, pubConfig, files);

    }

    /**
     * [checkAssetsPublished 判断当前assets是否发布]
     * @return 
     */
    function checkAssetsPublished() {
      var defered = Q.defer();
      var path = 'http://g.tb'+''+'cdn.cn/'+ awpConfig.group +'/'+ awpConfig.appName + '/' + awpConfig.version + '/';
      console.log('正在验证cdn上是否发布了该版本的assets：'+ path);

      request(path, function(error, res, body) {

          // 403 Forbidden
          if(res.statusCode == '403') {

              console.log(success('cdn上存在该版本的assets，验证通过！'));
              defered.resolve();

          } else if (res.statusCode == '404') {

              defered.reject();
              console.log(error('cdn上不存在该版本的assets，验证失败！请先去发布该项目的css/js并保证cdn地址生效，再发布awp!'));
              process.exit(0);
              
          }
        
      });

      return defered.promise;

    }

    /**
     * 根据参数拼接字符串生成 token
     * @param params
     * @returns {String}
     */
    function getToken(params) {

      var api = params.api;
      var data = params.data;
      var operator = params.operator;
      var t = params.t;
      var token = params.token;

      if (!api || !data || !operator || !t || !token) {
          return;
      }

      var SPLIT_STR = "&";

      return md5([api, data, operator, t, token].join(SPLIT_STR));

    }

    /**
     * 合并发布路径
     * @param env {String}
     * @param group {String}
     * @param project {String}
     * @param filePath {String}
     * @returns {string}
     */
    function concatPubPath(env, fileName) {

        "use strict";

        var hostPrefixMap = {
            'daily': 'h5.waptest',
            'prepub': 'h5.wapa',
            'wapp': 'wapp.m', //未定义
            'online': 'h5.m'
        };

        return 'http://' + [hostPrefixMap[env] + '.tao'+''+'bao.com', awpConfig.oWebappDir, fileName].join('/');

    }

    /**
     * 检查文件路径是否包含不建议的字符串，如 build 目录或 pages 目录
     * @param filePath
     * @returns {boolean}
     */
    function checkFileValid(filePath) {

      "use strict";

      var invalidFilepathReg = /(build\/|pages\/)/;
      return !invalidFilepathReg.test(filePath);

    }

    /**
     * 准备批量发布文件
     * @param awpConfig {Object} awp 配置项
     * @param pubConfig {Object} 发布配置
     * @param filePaths {Array} 待发布的文件（文件名数组）
     */
    function prepareBatchPubFiles(awpConfig, pubConfig, filePaths) {

        "use strict";

        awpConfig.group = awpConfig.group || 'o2o';

        var onlinePath,
            isPathInvalid;

        if(filePaths.length == 0) {
            console.log(error('您没有选中任何要发布的文件，请重新执行命令进行选择!'));
            process.exit(0);
        }

        console.log('您将要发布以下文件：');

        filePaths.forEach(function(filePath, idx) {
            var fileName = filePath.replace('./htmls-dist/', '');

            // 映射到的发布地址
            onlinePath = concatPubPath(pubConfig.env, fileName);

            // 是否包含不合法的字符串
            isPathInvalid = checkFileValid(onlinePath);

            // 打印确认
            console.log(isPathInvalid ? success(filePath) : warn(filePath));
            console.log(isPathInvalid ? success('    -> ' + clc.underline(onlinePath)) : warn('    -> ' + clc.underline(onlinePath)));

        });

        // 开始全部发布
        filePaths.forEach(function(filePath, i) {
            batchPubFiles(awpConfig, pubConfig, filePath);
        });

    }

    /**
     * 核心的发布处理
     * @param awpConfig {Object}
     * @param pubConfig {Object}
     * @param filePaths {Array}
     * @param fileBasePath {String} 文件 base 路径
     */
    function batchPubFiles(awpConfig, pubConfig, filePath, fileBasePath) {
      // console.log(filePath)
      "use strict";

      fileBasePath = fileBasePath || './htmls-dist/';

      var awpEnvPrefixMap = {
          'daily': 'daily.',
          'prepub': 'pre.',
          'wapp': '', //未定义
          'online': ''
      },
      baseUri = 'http://' + awpEnvPrefixMap[pubConfig.env] + 'h5.tao'+''+'bao.org/api/api.do?_input_charset=utf-8&api=push_file&webappId=';

      // 52 做跳板机
      var headers = {
          'X-Forwarded-For': '10.232.135.52'
      };

      // 要 post 的参数
      var params = {
          api: 'push_file',
          t: Date.now(),
          operator: awpConfig.cname,
          token: awpConfig.dToken,
          data: {
              uri: null,
              operator: awpConfig.cname,
              data: null,
              isPub: !(pubConfig.env === 'wapp'),
              webappId: awpConfig.dWebappId,
              pageData: JSON.stringify({
                  isautoparse: true,
                  needPerform: true,
                  autoPub: true,
                  delVersionIfExist: true
              })
          }
      };


      if (pubConfig.env === 'daily') {

          baseUri += awpConfig.dWebappId;

      } else {

          baseUri += awpConfig.oWebappId;
          params.data.webappId = awpConfig.oWebappId;
          params.token = awpConfig.oToken;
      }
    
      var fileParam = JSON.parse(JSON.stringify(params)); // Simple Clone

      // t 需要更新
      fileParam.t = Date.now();

      // uri 部分需要文件路径拼接
      fileParam.data.uri = [awpConfig.oWebappDir, filePath.replace(fileBasePath, '').replace(/\\/g, '/')].join('/');

      // console.log(fileParam.data.uri);

      // data 字段为文件内容
      fileParam.data.data = fs.readFileSync(filePath.replace(fileBasePath, ''), 'utf-8');

      // data 需要 JSON 序列化
      fileParam.data = JSON.stringify(fileParam.data);
      fileParam.token = getToken(fileParam);

      // console.log(fileParam);

      // 向 awp post 请求
      request.post({
          headers: headers,
          url: baseUri,
          form: fileParam,
          encoding: 'utf8',
          json: true
      }, function(err, response, ret) {

          if (err) {

              console.log('亲，抱歉发布失败了,请检查下您的网络连接！');
              console.error(err);

          } else if (!ret.success) {
            
              // 发布失败
              console.log(error('>> 发布失败 <%s>'), filePath);
              console.log(error(' | %s'), ret.msg.replace(/\n/igm, ''));
              process.exit(0);

          } else {

              // 发布成功
              if (ret.data) {
                  console.log(success('>> 发布成功，版本号：%s <%s>\n | 预览地址：%s\n | 线上地址：%s'), ret.data.versionId?ret.data.versionId:'预发无版本号', filePath, ret.data.previewUrl, ret.data.onlineUrl);
                  if(pubConfig.env == 'online') {
                      console.log('你会发现上面的预览地址已经生效了，下面的线上地址h5.m.tao'+''+'bao.com还没生效，此时系统正在进行性能验收，请耐心等待旺旺通知，一般需要3-5分钟，验收通过会自动发布！')
                  }
              } else {
                  console.log(success('>> 发布成功 -> %s'), filePath);
              }

          }

      });

    }


  });

};
