var fs = require('fs'),
    natives = process.binding('natives'),
    color = require('ansi-color').set;

var err_re = /    at ([^\s]+) \(([\w\d\._\-\/]+):(\d+):(\d+)\)/g;

var Trace = function(first_line, frames, original_error) {
  this.first_line = first_line;
  this.frames = frames;
  this.original_error;
};

Trace.defaults = [2, true, 'red'];

Trace.prototype.toString = function(reversed) {
  reversed === undefined && (reversed = true);
  var args = [].slice.call(args, 1);
  args.length === 0 && (args = Trace.defaults.slice());

  var frame_data = [this.first_line, '======\n'].concat(this.frames.map(function(frame) {
    return frame.toString.apply(frame, args);
  }));

  if(reversed)
    frame_data = frame_data.reverse();

  return frame_data.join('');
};

var Frame = function(named_location, filename, line, character) {
  this.named_location = named_location;
  this.filename = filename;
  this.line = line;
  this.character = character;
  this._filedata = null;
};

Frame.prototype.load_file_native = function() {
  var base_name = this.filename.replace(/\.js$/g, ''),
      data = natives[base_name] || '';

  return data;
};

Frame.prototype.load_file_path = function() {
  try {
    return fs.readFileSync(this.filename, 'utf8').toString();
  } catch(err) {
    return '';
  }
};

Frame.prototype.filedata = function() {
  if(this._filedata)
    return this._filedata;

  if(this.filename.indexOf('/') === -1) {
    this._filedata = this.load_file_native();
  } else {
    this._filedata = this.load_file_path();
  }
  return this._filedata;
};

Frame.prototype.toString = function() {
  var args = [].slice.call(arguments);
  return 'file '+color('"'+this.filename.replace(process.cwd(), '.')+'"', 'cyan')+' line '+color(this.line, 'red+bold')+', char '+color(this.character, 'red+bold')+', in '+color(this.named_location, 'cyan')+':\n'+
    color(this.get_lines.apply(this, args), 'yellow')+'\n';
};

Frame.prototype.get_lines = function(context, ascii_cursor, highlight_error_start) {
  context = context || 0; 
  filedata = this.filedata().split('\n');

  var start_line = this.line - context - 1,
      end_line = this.line + context,
      character = this.character;

  var lines = filedata.slice(start_line, end_line);

  if(highlight_error_start) {
    lines = lines.map(function(line, idx) {
      if(idx === context) {
        line = line.split(/\b/g);
        var start = 0;
        line = line.map(function(word) {
          var next = start + word.length;
          if(character <= next && character >= start) {
            word = color(word, highlight_error_start);
          }
          start = next;
          return word;
        }).join('');
      }
      return line;
    });
  }
  if(ascii_cursor) {
    lines = lines.map(function(line, idx) {
      return (idx === context ? '>' : ' ') + line;
    });
  }

  return lines.join('\n');
};

var trace = function(err) {
  if(!err) {
    err = {};
    Error.captureStackTrace(err);
  }

  var lines = err.stack.split('\n'),
      first = lines[0],
      stack = lines.slice(1).join('\n');

  var frames = [],
      match;

  do {
    match = err_re(stack);
    if(match) {
      frames.push(
        new Frame(match[1], match[2], parseInt(match[3], 10), parseInt(match[4], 10))
      );
    }
  } while(match);

  return new Trace(first, frames, err);
};

exports.trace = trace;
exports.Frame = Frame;
exports.Trace = Trace;

exports.set_context = function(context) {
  Trace.defaults[0] = context;
};

exports.set_add_cursor = function(tf) {
  Trace.defaults[1] = tf;
};
