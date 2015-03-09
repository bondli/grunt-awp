/*
 * grunt-awp
 * https://github.com/bondli/grunt-awp
 *
 * Copyright (c) 2015 pixi
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

  // Load grunt tasks automatically
  //require('load-grunt-tasks')(grunt);

  // Time how long tasks take. Can help when optimizing build times
  //require('time-grunt')(grunt);

  var appConfig = {
    publishFiles: '*.html',
    awpConfig: {
      group: 'o2o',
      appName: 'mobile_cifylife_portal',
      version: '0.0.1',
      dWebappId: 567,
      oWebappId: 251,
      oWebappDir: 'citylife/test'
    }
  };

  // Project configuration.
  grunt.initConfig({

    // Configuration to be run (and then tested).
    awp: {
      daily: {
        options: {
          awpConfig: appConfig.awpConfig,
          env: 'daily'
        },
        files: { 'htmls' : './htmls-dist/' + appConfig.publishFiles }
      },
      prepub: {
        options: {
          awpConfig: appConfig.awpConfig,
          env: 'prepub'
        },
        files: { 'htmls' : './htmls-dist/' + appConfig.publishFiles }
      },
      online: {
        options: {
          awpConfig: appConfig.awpConfig,
          env: 'online'
        },
        files: { 'htmls' : './htmls-dist/' + appConfig.publishFiles }
      }
    }

  });

  // Actually load this plugin's task(s).
  grunt.loadTasks('tasks');

  grunt.registerTask('publish', 'publish htmls to awp', function (target, files) {
    if (files) {
      appConfig.publishFiles = files;
    }

    if (target === 'p') { //预发
      return grunt.task.run(['awp:prepub']);
    }
    else if (target === 'o') { //线上
      return grunt.task.run(['awp:online']);
    }
    else { //日常
      return grunt.task.run(['awp:daily']);
    }

  });

};
