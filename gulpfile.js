const gulp        = require('gulp');
const babel       = require('gulp-babel');
const uglify      = require('gulp-uglify-es').default;
const rename      = require('gulp-rename');
const clean       = require('gulp-clean');
const jshint      = require('gulp-jshint');
const mocha       = require('gulp-mocha');
const sourcemaps  = require('gulp-sourcemaps');
const livereload  = require('gulp-livereload');
const exec        = require('gulp-exec');
const sequence    = require('run-sequence');
const symlink     = require('gulp-symlink');
const fs          = require('fs');
const path        = require('path');
const rmdir       = require('rmdir');
const yaml        = require('gulp-yaml');

const babelOptions = {
  presets: [
    [
      'env',
      {
        targets: {
          node: 'current'
        }
      }
    ]
  ],
  plugins: ['add-module-exports']
};

gulp.task('lint', () => {
  return gulp.src([
    './tests/**/*.js',
    './src/**/*.js'
  ])
  .pipe(jshint())
  .pipe(jshint.reporter('jshint-stylish'))
  .pipe(jshint.reporter('fail'));
});

gulp.task('clean', () => {
  gulp.src([
    './dist/*',
    './dist',
    './*.tgz',
    './services/environment',
    './services/start_systemd.sh',
    './services/systemd/candy-red.service',
    './services/systemd/environment',
  ])
  .pipe(clean({force: true}))
});

gulp.task('nodes', () => {
  return Promise.all(fs.readdirSync('node_modules/')
  .filter(f => f.indexOf('local-node-') === 0)
  .filter(f => {
    try {
      return fs.statSync(`node_modules/${f}`).isDirectory();
    } catch (_) {
      return false;
    }
  })
  .map(f => {
    return new Promise((resolve, reject) => rmdir(`node_modules/${f}`, (err) => {
      if (err) {
        return reject(err);
      }
      return resolve();
    }))
  })).then(() => {
    return gulp.src('./dist/nodes/local-*')
    .pipe(symlink((f) => {
      return path.join(`node_modules/${f.relative}`);
    }));
  });
});

gulp.task('copyResources', () => {
  gulp.src([
    './src/**/*.{css,ico,png,html,json,yaml,yml}',
    '!./src/mo/**/*.{yaml,yml}'
  ])
  .pipe(gulp.dest('./dist'));
});

gulp.task('favicons', () => {
  return gulp.src('./src/public/images/icon*.png')
    .pipe(gulp.dest('./node_modules/node-red-dashboard/dist'));
});

gulp.task('mo', () => {
  return gulp.src([
      './src/mo/**/*.{yaml,yml}'
    ])
    .pipe(yaml({ safe: true }))
    .pipe(gulp.dest('./dist/mo'));
});

gulp.task('buildSrcs', ['copyResources', 'mo', 'favicons'], () => {
  return gulp.src('./src/**/*.js')
    .pipe(sourcemaps.init())
    .pipe(babel({
      minified: true,
      compact: true,
      presets: babelOptions.presets,
      plugins: babelOptions.plugins,
    }))
    .pipe(uglify({
      mangle: {
      },
      compress: {
        dead_code: true,
        drop_debugger: true,
        properties: true,
        unused: true,
        toplevel: true,
        if_return: true,
        drop_console: false,
        conditionals: true,
        unsafe_math: true,
        unsafe: true
      },
    }))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('./dist'))
    .pipe(livereload());
});

gulp.task('build', (done) => {
  sequence('buildSrcs', 'nodes', done);
});

gulp.task('copyTestResources', () => {
  gulp.src('./tests/**/*.{css,ico,png,html,json,yaml,yml}')
  .pipe(gulp.dest('./dist'));
});

gulp.task('buldTests', ['buildSrcs','copyTestResources'], () => {
  return gulp.src('./tests/**/*.js')
    .pipe(sourcemaps.init())
    .pipe(babel({
      presets: babelOptions.presets,
      plugins: babelOptions.plugins,
    }))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('./dist'));
});

gulp.task('watch', ['build'], () => {
  livereload.listen();
  gulp.watch('./src/*.js', ['build']);
});

gulp.task('test', ['lint', 'buldTests'], () => {
  return gulp.src([
    './dist/**/*.test.js',
  ], {read: false})
  .pipe(mocha({
    require: ['source-map-support/register'],
    reporter: 'spec'
  }))
  .once('error', () => process.exit(1))
  .once('end', () => process.exit())
});

gulp.task('default', ['build']);
