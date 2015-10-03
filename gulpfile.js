var gulp = require('gulp'),
    gls = require('gulp-live-server'),
    uglify = require('gulp-uglifyjs'),
    rename = require("gulp-rename");
//___________________________________________________
/*
gulp.task('default', ['lint']);
gulp.task('lint', ['jslint']);
gulp.task('build', ['lint', 'browserify', 'uglify']);

//___________________________________________________
// npm i --save-dev gulp-jshint jshint-stylish
var jshint = require('gulp-jshint'),
    stylish = require('jshint-stylish');

gulp.task('jslint', function() {
    gulp.src('./index.js')
        .pipe(jshint())
        .pipe(jshint.reporter(stylish));
});*/
//___________________________________________________
gulp.task('serve-test', function() {
    var server = gls.static(".", 8287);
    server.start();
    //live reload changed resource(s) 
    gulp.watch(['dist/**/*.js', 'test/**/*.js'], server.notify);
});

//___________________________________________________
gulp.task('uglify', function() {
    gulp.src('dist/yamvish.js')
        .pipe(uglify())
        .pipe(rename('yamvish.min.js'))
        .pipe(gulp.dest('./dist'))
});

//___________________ browserify
/*
var browserify = require('gulp-browserify');
gulp.task('browserify', function() {
    // Single entry point to browserify 
    gulp.src('index.js')
        .pipe(browserify({
            standalone: true,
            insertGlobals: false,
            debug: false // !gulp.env.production
        }))
        .pipe(rename('yamvish.js'))
        .pipe(gulp.dest('./dist'))
});
*/
