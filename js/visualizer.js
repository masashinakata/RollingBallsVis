(function ($) {
  var Context = CanvasRenderingContextPostscript;

  $.extend(Context.prototype, (function () {
    function hypot(x1, y1, x2, y2) {
      var x = x2 - x1;
      var y = y2 - y1;
      
      return Math.sqrt(x * x + y * y);
    }

    function arrow(x1, y1, x2, y2, a1, a2, a3) {
      var d = hypot(x1, y1, x2, y2);

      var theta = Math.atan2(y2 - y1, x2 - x1);
      
      this.matrixexec(this.currentMatrix(), function () {
        this.translate(x1, y1);

        this.rotate(theta);

        this.moveTo(0, 0);

        this.rmoveTo(0, -a1 / 2);

        this.rlineTo(d - a3, 0);
        
        this.rlineTo(0, -(a2 - a1) / 2);
        
        this.lineTo(d, 0);
        
        this.rlineTo(-a3, a2 / 2, 0);

        this.rlineTo(0, -(a2 - a1) / 2);

        this.rlineTo(-(d - a3), 0);
        
        this.closePath();
      });
    }

    function box(x, y, w, h) {
      this.moveTo(x, y);
      
      this.rlineTo(w, 0);

      this.rlineTo(0, h);

      this.rlineTo(-w, 0);
      
      this.closePath();
    }

    function grid(x, y, w, h) {
      this.box(x, y, w, h);

      for (var i = 1; i < h; i ++) {
	this.moveTo(0, i);
	this.rlineTo(w, 0);

	this.moveTo(i, 0);
	this.rlineTo(0, h);
      }
    }

    function darrow(x1, y1, x2, y2, a1, a2, a3) {
      var d = hypot(x1, y1, x2, y2);

      var theta = Math.atan2(y2 - y1, x2 - x1);
      
      this.matrixexec(this.currentMatrix(), function () {
        this.translate(x1, y1);

        this.rotate(theta);

        this.moveTo(0, 0);

        this.rlineTo(a3, -a2 / 2);

        this.rlineTo(0, (a2 - a1) / 2);

        this.rlineTo(d - a3 * 2, 0);
        
        this.rlineTo(0, -(a2 - a1) / 2);
        
        this.lineTo(d, 0);
        
        this.rlineTo(-a3, a2 / 2, 0);

        this.rlineTo(0, -(a2 - a1) / 2);

        this.rlineTo(-(d - a3 * 2), 0);
        
        this.rlineTo(0, (a2 - a1) / 2);

        this.closePath();
      });
    }

    function matrixexec(m, fn) {
      var mm = this.currentMatrix();

      Context.prototype.setTransform.apply(this, m);

      var r = fn.apply(this);

      Context.prototype.setTransform.apply(this, mm);
      
      return r;
    };

    return {
      arrow:      arrow,
      box:        box,
      darrow:     darrow,
      grid:       grid,
      matrixexec: matrixexec
    };
  })());
})(jQuery);

(function ($) {
  var Context = CanvasRenderingContextPostscript;

  var show = Context.prototype.show;
  
  Context.prototype.show = function (text) {
    this.matrixexec(this.currentMatrix(), function () {
      var p = this.currentPoint();

      this.translate(p[0], p[1]);

      show.call(this, text);
    });
  };

  Context.prototype.setGridWidth = function (x) {
    this.setLineWidth(x % 10 == 0 ? 2 : x % 5 == 0 ? 1.5 : 0.75);
  };
})(jQuery);

var Visualizer = (function ($) {
  var CANVAS_SIZE = 960;

  var MAX_CELL_SIZE = 47;

  return function (canvas, seed, start, target, result) {
    this.canvas  = canvas;
    this.context = canvas.getContext('postscript');

    var H = this.H = start   .length;
    var W = this.W = start[0].length;

    this.scale = Math.min(CANVAS_SIZE / Math.max(H, W), MAX_CELL_SIZE);

    console.log("scale=" + this.scale);

    this.start  = start;
    this.target = target;
    this.result = result;

    this.N = 0;

    for (var i = 0; i < H; i ++)
      for (var j = 0; j < W; j ++) {
	var c = start[i][j];

	if ('0' <= c && c <= '9')
	  this.N ++;
      }

    var board = this.board = this.make_editable(start);

    this.step = 0;

    this.c1 = 0;
    this.c2 = 0;

    this.cache = [JSON.parse(JSON.stringify(this.board))];

    this.S = { x : 0, y: 0 };
    this.E = { x : 0, y: 0 };

    this.dragging = { enabled: false, x: 0, y: 0, ox: 0, oy: 0, ix: 0, iy: 0, c: -1 };

    $('#seed' ).text(this.seed = seed);
    $('#steps').text(this.step_string());
    $('#score').text(this.score_string());
  };
})(jQuery);

(function ($) {
  var Context = CanvasRenderingContextPostscript;

  function hypot(x1, y1, x2, y2) {
    var x = x2 - x1;
    var y = y2 - y1;

    return Math.sqrt(x * x + y * y);
  }

  $.extend(Visualizer.prototype, (function () {
    function setdefault(hash, key, value) {
      if (! hash[key])
	hash[key] = value;
    }

    function clear(context) {
      context.clearRect(-2, -2, 2222, 2222);
    }

    function doit() {
      var canvas  = this.canvas;
      var context = this.context;

      this.dm = context.currentMatrix();

      draw.call(this);

      event.call(this);
    }

    function scaled(method) {
      var context = this.context, scale = this.scale;

      context.matrixexec(context.currentMatrix(), function () {
	context.scale(scale, scale);

	method.apply(this, Array.prototype.slice(arguments, 1));
      }.bind(this));
    }

    var BALL_COLORS = [
      [0.25, 0.0,  1.0],	// 0x4000FF
      [1.0,  0.0,  0.75],	// 0xFF00BF
      [0.0,  0.75, 1.0],	// 0x00BFFF
      [1.0,  0.85, 0.38],	// 0xFFD761
      [1.0,  0.25, 0.0],	// 0xFF4000
      [0.25, 1.0,  0.0],	// 0x40FF00
      [0.7,  0.0,  0.175],	// 0xB3002D
      [0.0,  0.6,  0.45],	// 0x009973
      [0.6,  0.6,  0.6],	// 0x999999
      [0.25, 0.25, 0.25]	// 0x404040
    ];

    var RADIUS = 0.45;

    function draw_board() {
      var H = this.H, W = this.W;

      scaled.call(this, function () {
	var context = this.context;

	var board  = this.board;
	var target = this.target;

	context.setGray(0);

	for (var i = 0; i < H; i ++)
	  for (var j = 0; j < W; j ++) {
	    var c = board[i][j];

	    if (c == '#') {
	      context.box(j, i, 1, 1);
	      
	      context.fill();
	    }
	  }

	context.setGray(0);

	for (var i = 0; i <= H; i ++) {
          context.moveTo(0, i);

	  context.rlineTo(W, 0);

	  context.setGridWidth(i);

	  context.matrixexec(this.dm, function () {
	    context.stroke();
	  }.bind(this));
	}

	for (var j = 0; j <= W; j ++) {
          context.moveTo(j, 0);

	  context.rlineTo(0, H);

	  context.setGridWidth(j);

	  context.matrixexec(this.dm, function () {
	    context.stroke();
	  }.bind(this));
	}

	context.setGray(0);

	context.setLineWidth(1);
      });
    }

    var BALL_BORDER_WIDTH = 2;

    function draw_ball(x, y, c, o) {
      var context = this.context;

      context.setGray(0, o);

      context.setLineWidth(BALL_BORDER_WIDTH);

      var color = BALL_COLORS[c - '0'].slice();

      color.push(o);

      Context.prototype.setRGBColor.apply(context, color);

      context.arc(x, y, RADIUS, 0, 360);

      context.fill();
      
      context.newPath();
      
      context.setGray(0, o);
      
      context.arc(x, y, RADIUS, 0, 360);
      
      context.matrixexec(this.dm, function () {
	context.stroke();
      }.bind(this));
    }

    var GHOST_OPACITY = 0.1;

    function draw_ghosts() {
      var H = this.H, W = this.W;

      scaled.call(this, function () {
	var context = this.context;

	var board = this.board;

	var ghost = JSON.parse(JSON.stringify(board));

	var segments = [];

	for (var i = 0; i < H; i ++)
	  for (var j = 0; j < W; j ++)
	    ghost[i][j] = '.';

	for (var i = 0; i < H; i ++)
	  for (var j = 0; j < W; j ++) {
	    var c = board[i][j];

	    if (c < '0' || '9' < c)
	      continue;

	    for (var k = 0; k < 4; k ++) {
	      if (j == 0 || board[i][j - 1] != '.') {
		var x = j, y = i, xx, yy;

		for ( ; x < W - 1; x = xx)
		  if (board[y][xx = x + 1] != '.')
		    break;

		if (x != j) {
		  ghost[i][x] = c;

		  segments.push([[j, i], [x, i]]);
		}
	      }
	      if (i == H - 1 || board[i + 1][j] != '.') {
		var x = j, y = i, xx, yy;

		for ( ; y > 0; y = yy)
		  if (board[yy = y - 1][x] != '.')
		    break;

		if (y != i) {
		  ghost[y][j] = c;

		  segments.push([[j, i], [j, y]]);
		}
	      }
	      if (j == W - 1 || board[i][j + 1] != '.') {
		var x = j, y = i, xx, yy;

		for ( ; x > 0; x = xx)
		  if (board[y][xx = x - 1] != '.')
		    break;

		if (x != j) {
		  ghost[i][x] = c;

		  segments.push([[j, i], [x, i]]);
		}
	      }
	      if (i == 0 || board[i - 1][j] != '.') {
		var x = j, y = i, xx, yy;

		for ( ; y < H - 1; y = yy)
		  if (board[yy = y + 1][x] != '.')
		    break;

		if (y != i) {
		  ghost[y][j] = c;

		  segments.push([[j, i], [j, y]]);
		}
	      }
	    }
	  }

	context.setGray(0);

	context.setLineWidth(BALL_BORDER_WIDTH);

	for (var i = 0; i < H; i ++)
	  for (var j = 0; j < W; j ++) {
	    var c = ghost[i][j];

	    if (c < '0' || c > '9')
	      continue;

	    var c = BALL_COLORS[c - '0'].slice();

	    c.push(GHOST_OPACITY);

            Context.prototype.setRGBColor.apply(context, c);

	    context.arc(j + 0.5, i + 0.5, RADIUS, 0, 360);

	    context.fill();

	    context.newPath();

	    context.setGray(0, GHOST_OPACITY);

	    context.arc(j + 0.5, i + 0.5, RADIUS, 0, 360);

	    context.matrixexec(this.dm, function () {
	      context.stroke();
	    }.bind(this));
	  }

	context.setGray(0, GHOST_OPACITY);

	context.setLineWidth(1);

	for (var i = 0; i < segments.length; i ++) {
	  context.moveTo(segments[i][0][0] + 0.5, segments[i][0][1] + 0.5);
	  
	  context.lineTo(segments[i][1][0] + 0.5, segments[i][1][1] + 0.5);
	}

	context.matrixexec(this.dm, function () {
	  context.stroke();
	}.bind(this));

	context.setGray(0);
      });
    }

    var DRAGGED_OPACITY = 0.1;

    function draw_balls() {
      var H = this.H, W = this.W;

      scaled.call(this, function () {
	var context = this.context;

	var board  = this.board;
	var target = this.target;

	context.setGray(0);

	context.setLineWidth(BALL_BORDER_WIDTH);

	for (var i = 0; i < H; i ++)
	  for (var j = 0; j < W; j ++) {
	    var dragged = false;

	    if (this.dragging.enabled)
	      if (this.dragging.c >= 0)
		if (j == this.dragging.ix && i == this.dragging.iy)
		  dragged = true;

	    var c = board[i][j];

	    if (c < '0' || '9' < c)
	      continue;

	    var color = BALL_COLORS[c - '0'].slice();

	    if (dragged)
	      color.push(DRAGGED_OPACITY);

            Context.prototype.setRGBColor.apply(context, color);

	    context.arc(j + 0.5, i + 0.5, RADIUS, 0, 360);

	    context.fill();

	    context.newPath();

	    if (dragged) {
	      context.setGray(0, DRAGGED_OPACITY);
	    }
	    else {
	      context.setGray(0);
	    }

	    context.arc(j + 0.5, i + 0.5, RADIUS, 0, 360);

	    context.matrixexec(this.dm, function () {
	      context.stroke();
	    }.bind(this));
	  }

	context.setGray(0);

	context.setLineWidth(1);
      });
    }

    function draw_next_move() {
      var H = this.H, W = this.W;

      scaled.call(this, function () {
	var context = this.context;

	if (this.step >= this.result.length)
	  return;

	context.setGray(0, 0.5);

	var board = this.board;

	var t = this.result[this.step];

	var x0 = t[1], y0 = t[0], z0 = t[2];

	var x = x0, y = y0, xx, yy;

	if (z0 == 0) {
	  for ( ; x > 0; x = xx)
	    if (board[y][xx = x - 1] != '.')
	      break;
	}
	else if (z0 == 1) {
	  for ( ; y < this.H - 1; y = yy)
	    if (board[yy = y + 1][x] != '.')
	      break;
	}
	else if (z0 == 2) {
	  for ( ; x < this.W - 1; x = xx)
	    if (board[y][xx = x + 1] != '.')
	      break;
	}
	else {
	  for ( ; y > 0; y = yy)
	    if (board[yy = y - 1][x] != '.')
	      break;
	}

	var p, q;

	context.moveTo(x0 + 0.5, y0 + 0.5);

	context.matrixexec(this.dm, function () {
	  p = context.currentPoint();
	});

	context.moveTo(x + 0.5, y + 0.5);

	context.matrixexec(this.dm, function () {
	  q = context.currentPoint();

	  context.arrow(p[0], p[1], q[0], q[1], 2, 8, 15);
	  
	  context.fill();
	});

	context.setGray(0);
      });
    }

    var TARGET_BORDER_WIDTH = 3;

    function draw_target() {
      var H = this.H, W = this.W;

      scaled.call(this, function () {
	var context = this.context;

	var board  = this.board;
	var target = this.target;

	context.setLineWidth(TARGET_BORDER_WIDTH);

	for (var i = 0; i < H; i ++)
	  for (var j = 0; j < W; j ++) {
	    var c = target[i][j];

	    if (c < '0' || '9' < c)
	      continue;

            Context.prototype.setRGBColor.apply(context, BALL_COLORS[c - '0']);

	    context.box(j, i, 1, 1, RADIUS, 0, 360);

	    context.matrixexec(this.dm, function () {
	      context.stroke();
	    }.bind(this));
	  }

	context.setLineWidth(1);
      });
    }

    var RADIUS_THRESHOLD = 0.2;

    function region_from_offset() {
      var ox = this.dragging.ox / this.scale;
      var oy = this.dragging.oy / this.scale;

      var radius = Math.sqrt(ox * ox + oy * oy);
      
      var theta = Math.atan2(oy, ox);

      var region = '-';

      if (radius > RADIUS_THRESHOLD) {
	if (- Math.PI * 1 / 6 < theta && theta < Math.PI * 1 / 6) {
	  region = 'R';
	}
	else if (Math.PI * 2 / 6 < theta && theta < Math.PI * 4 / 6) {
	  region = 'D';
	}
	else if (Math.PI * 5 / 6 < theta || theta < - Math.PI * 5 / 6) {
	  region = 'L';
	}
	else if (- Math.PI * 4 / 6 < theta && theta < - Math.PI * 2 / 6) {
	  region = 'U';
	}
	else {
	  region = '.';
	}
      }
      
      return region;
    }

    var DRAGGING_OPACITY           = 0.8;
    var DRAGGING_NEXT_MOVE_OPACITY = 0.75;
    var DRAGGING_CANDIDATE_OPACITY = 0.2;

    var DRAGGING_THRESHOLD = 0.75;

    var DRAGGING_RADIUS = 4;

    var DRAGGING_TRANSPARENCY = 0.333;

    var DRAGGING_ACTIVE_TRANSPARENCY   = 0.5;
    var DRAGGING_INACTIVE_TRANSPARENCY = 0.2;

    function draw_dragging() {
      if (! this.dragging.enabled)
	return;

      var H = this.H, W = this.W;

      var c = this.dragging.c;

      var ix = this.dragging.ix;
      var iy = this.dragging.iy;

      var ox = this.dragging.ox;
      var oy = this.dragging.oy;

      var region = region_from_offset.call(this);

      scaled.call(this, function () {
	var context = this.context;

	if (c == -1) {
	  context.matrixexec(this.dm, function () {
	    var dx = this.E.x - this.S.x;
	    var dy = this.E.y - this.S.y;

	    var d = Math.sqrt(dx * dx + dy * dy);

	    var dp = $('#canvas').width();

	    context.setGray(0, DRAGGING_TRANSPARENCY);

	    context.setLineWidth(1);

	    if ('LR'.indexOf(region) >= 0)
	      if (d > dp * DRAGGING_THRESHOLD)
		context.setLineWidth(3);

	    var p0, p1;

	    context.moveTo(this.dragging.x, this.dragging.y);

	    context.matrixexec(this.dm, function () {
	      p0 = context.currentPoint();
	    }.bind(this));

	    context.rmoveTo(ox, oy);

	    context.matrixexec(this.dm, function () {
	      p1 = context.currentPoint();
	    }.bind(this));

	    context.matrixexec(this.dm, function () {
	      var dx = p1[0] - p0[0];
	      var dy = p1[1] - p0[1];

	      var l = Math.sqrt(dx * dx + dy * dy);

	      var a = Math.min(DRAGGING_RADIUS * 3, l) / l;

	      context.moveTo(p0[0] + dx * a / 2, p0[1] + dy * a / 2);
	      context.lineTo(p1[0] - dx * a / 2, p1[1] - dy * a / 2);
	      
	      context.stroke();
	    }.bind(this));

	    context.matrixexec(this.dm, function () {
	      context.arc(p0[0], p0[1], DRAGGING_RADIUS, 0, 360);

	      context.fill();

	      context.arc(p1[0], p1[1], DRAGGING_RADIUS, 0, 360);

	      context.fill();
	    }.bind(this));
	  }.bind(this));
	}
	else {
	  context.moveTo(ix + 0.5, iy + 0.5);

	  context.matrixexec(this.dm, function () {
	    context.rmoveTo(ox, oy);
	  }.bind(this));

	  var p = context.currentPoint();

	  draw_ball.call(this, p[0], p[1], c, DRAGGING_OPACITY);

	  context.matrixexec(context.currentMatrix(), function () {
	    context.translate(0.5, 0.5);
	    
	    var x = ix, y = iy, xx, yy;

	    // left

	    for ( ; x > 0; x = xx)
	      if (this.board[y][xx = x - 1] != '.')
		break;

	    if (x != ix) {
	      if (region == 'L') {
		draw_ball.call(this, x, iy, c, DRAGGING_NEXT_MOVE_OPACITY);
	      }
	      else {
		draw_ball.call(this, x, iy, c, DRAGGING_CANDIDATE_OPACITY);
	      }

	      context.moveTo(ix, iy);

	      context.lineTo(x, iy);

	      if (region == 'L') {
		context.setGray(0, DRAGGING_ACTIVE_TRANSPARENCY);
	      }
	      else {
		context.setGray(0, DRAGGING_INACTIVE_TRANSPARENCY);
	      }

	      context.matrixexec(this.dm, function () {
		context.stroke();
	      }.bind(this));
	    }

	    // down

	    x = ix;
	    y = iy;

	    for ( ; y < H - 1; y = yy)
	      if (this.board[yy = y + 1][x] != '.')
		break;
	    
	    if (y != iy) {
	      if (region == 'D') {
		draw_ball.call(this, ix, y, c, DRAGGING_NEXT_MOVE_OPACITY);
	      }
	      else {
		draw_ball.call(this, ix, y, c, DRAGGING_CANDIDATE_OPACITY);
	      }

	      context.moveTo(ix, iy);

	      context.lineTo(ix, y);

	      if (region == 'D') {
		context.setGray(0, DRAGGING_ACTIVE_TRANSPARENCY);
	      }
	      else {
		context.setGray(0, DRAGGING_INACTIVE_TRANSPARENCY);
	      }

	      context.matrixexec(this.dm, function () {
		context.stroke();
	      }.bind(this));
	    }

	    // right

	    x = ix; y = iy;

	    for ( ; x < W - 1; x = xx)
	      if (this.board[y][xx = x + 1] != '.')
		break;
	    
	    if (x != ix) {
	      if (region == 'R') {
		draw_ball.call(this, x, iy, c, DRAGGING_NEXT_MOVE_OPACITY);
	      }
	      else {
		draw_ball.call(this, x, iy, c, DRAGGING_CANDIDATE_OPACITY);
	      }

	      context.moveTo(ix, iy);

	      context.lineTo(x, iy);

	      if (region == 'R') {
		context.setGray(0, DRAGGING_ACTIVE_TRANSPARENCY);
	      }
	      else {
		context.setGray(0, DRAGGING_INACTIVE_TRANSPARENCY);
	      }

	      context.matrixexec(this.dm, function () {
		context.stroke();
	      }.bind(this));
	    }

	    // up

	    x = ix; y = iy;

	    for ( ; y > 0; y = yy)
	      if (this.board[yy = y - 1][x] != '.')
		break;
	    
	    if (y != iy) {
	      if (region == 'U') {
		draw_ball.call(this, ix, y, c, DRAGGING_NEXT_MOVE_OPACITY);
	      }
	      else {
		draw_ball.call(this, ix, y, c, DRAGGING_CANDIDATE_OPACITY);
	      }

	      context.moveTo(ix, iy);

	      context.lineTo(ix, y);

	      if (region == 'U') {
		context.setGray(0, DRAGGING_ACTIVE_TRANSPARENCY);
	      }
	      else {
		context.setGray(0, DRAGGING_INACTIVE_TRANSPARENCY);
	      }

	      context.matrixexec(this.dm, function () {
		context.stroke();
	      }.bind(this));
	    }
	  }.bind(this));

	  context.setGray(0);

	  context.setLineWidth(1);
	}
      });
    }

    function number_of_available_cells() {
      var H = this.H, W = this.W, F = this.F;

      var f = F;

      var board = this.board, orig = this.orig;

      for (var i = 0; i < H; i ++)
	for (var j = 0; j < W; j ++)
	  if (board[i][j] != orig[i][j])
	    f --;

      return f;
    }

    function draw() {
      var context = this.context;
      
      context.setTransform.apply(context, this.dm);
      
      clear(context);
      
      context.translate(10, 10);
      
      draw_board.call(this);

      if (false)
	draw_ghosts.call(this);

      draw_balls.call(this);

      draw_next_move.call(this);

      draw_target.call(this);

      draw_dragging.call(this);

      $('#steps').text(this.step_string());

      $('#score').text(this.score_string());
    }

    function event() {
      var H = this.H, W = this.W;

      var seed = this.seed.replace(/[a-zA-Z]*/g, '') - 0;

      $('#canvas')
	.mousemove(function (e) {
	  e = e.originalEvent;
	  
	  this.on('mousemove', e.offsetX, e.offsetY);
	  
	  e.preventDefault();
	}.bind(this))
	.mousedown(function (e) {
	  e = e.originalEvent;
	  
	  this.on('mousedown', e.offsetX, e.offsetY);
	  
	  e.preventDefault();
	}.bind(this))
	.mouseup(function (e) {
	  e = e.originalEvent;

	  this.on('mouseup', e.offsetX, e.offsetY);
	  
	  e.preventDefault();
	}.bind(this))
	.on('touchstart', function (e) {
	  e = e.originalEvent;
	  
	  var n = e.touches.length;

	  this.on('touchstart', e.touches[n - 1].clientX, e.touches[n - 1].clientY);

	  e.preventDefault();
	}.bind(this))
	.on('touchmove', function (e) {
	  e = e.originalEvent;

	  var n = e.touches.length;

	  this.on('touchmove', e.touches[n - 1].clientX, e.touches[n - 1].clientY);

	  e.preventDefault();
	}.bind(this))
	.on('touchend', function (e) {
	  e = e.originalEvent;

	  this.on('touchend', this.E.x, this.E.y);

	  e.preventDefault();
	}.bind(this));

      $(window)
	.keypress(function (e) {
	  var step   = this.step;
	  var result = this.result;
	  var cache  = this.cache;

	  if (e.which == 110 /* n */) {
	    // The number of cache must be equal to this.step + 1.

	    if (step < result.length) {
	      if (cache.length == step + 1) {
		var board = JSON.parse(JSON.stringify(cache[step]));

		var c = result[step];

		var x = c[1], y = c[0], z = c[2];

		var x0 = x, y0 = y;

		if (z == 0) {
		  for ( ; x > 0; x = xx)
		    if (board[y][xx = x - 1] != '.')
		      break;
		}
		else if (z == 1) {
		  for ( ; y < this.H - 1; y = yy)
		    if (board[yy = y + 1][x] != '.')
		      break;
		}
		else if (z == 2) {
		  for ( ; x < this.W - 1; x = xx)
		    if (board[y][xx = x + 1] != '.')
		      break;
		}
		else {
		  for ( ; y > 0; y = yy)
		    if (board[yy = y - 1][x] != '.')
		      break;
		}

		board[y][x] = board[y0][x0];

		board[y0][x0] = '.';

		cache.push(board);
	      }

	      this.step = ++ step;

	      this.board = this.make_editable(cache[step]);
	    }

	    draw.call(this);

	    e.preventDefault();
	  }
	  else if (e.which == 112 /* p */) {
	    if (step > 0)
	      this.step = -- step;

	    this.board = this.make_editable(cache[step]);

	    draw.call(this);

	    e.preventDefault();
	  }
	}.bind(this));
    }

    function dc2ndc(x) {
      return Math.floor((x - 10) / this.scale);
    }

    function on(ev, x, y) {
      if (ev == 'gesturestart') {
      }
      else if (ev == 'gesturechange') {
      }
      else if (ev == 'gestureend') {
      }
      else if (ev == 'mousedown' || ev == 'touchstart') {
	var ix = dc2ndc.call(this, this.S.x = x);
	var iy = dc2ndc.call(this, this.S.y = y);

	var c = -1;

	if (ev == 'mousedown') {
	  if (0 <= ix && ix < this.W && 0 <= iy && iy < this.H)
	    c = this.board[iy][ix];
	}
	else {
	  var dm = 1e+9;

	  for (var i = iy - 1, ip = iy + 1; i <= ip; i ++)
	    for (var j = ix - 1, jp = ix + 1; j <= jp; j ++)
	      if (0 <= j && j < this.W && 0 <= i && i < this.H) {
		var cc = this.board[i][j];

		if ('0' <= cc && cc <= '9') {
		  scaled.call(this, function () {
		    var context = this.context;

		    context.moveTo(j + 0.5, i + 0.5);
		    
		    context.matrixexec(this.dm, function () {
		      var p = context.currentPoint();

		      var d = Math.pow(p[0] - x, 2) + Math.pow(p[1] - y, 2);

		      if (false)
			console.log(i + ' ' + j + ' ' + d + '(' + dm + ')');
		      
		      if (d < dm) {
			dm = d;
			ix = j;
			iy = i;
			c  = cc;
		      }
		    }.bind(this));
		  }.bind(this));
		}
	      }
	}

	this.dragging.enabled = true;
	this.dragging. x      =  x;
	this.dragging. y      =  y;
	this.dragging.ix      = ix;
	this.dragging.iy      = iy;
	this.dragging.ox      = 0;
	this.dragging.oy      = 0;
	this.dragging.c       = -1;

	if ('0' <= c && c <= '9') {
	  this.dragging.c       = c;

	  this.draw();
	}
      }
      else if (ev == 'mousemove' || ev == 'touchmove') {
	this.E.x = x;
	this.E.y = y;

	if (this.dragging.enabled) {
	  this.dragging.ox = this.E.x - this.S.x;
	  this.dragging.oy = this.E.y - this.S.y;

	  this.draw();
	}

	var ix = dc2ndc.call(this, x);
	var iy = dc2ndc.call(this, y);

	$('#coord').text((ix + 1) + ', ' + (iy + 1));
      }
      else if (ev == "mouseup" || ev == "touchend") {
	this.E.x = x;
	this.E.y = y;

	if (this.dragging.enabled) {
	  this.dragging.enabled = false;

	  this.dragging.ox = this.E.x - this.S.x;
	  this.dragging.oy = this.E.y - this.S.y;

	  var region = region_from_offset.call(this);

	  if (this.dragging.c >= 0) {
	    if (region != '.' && region != '-') {
	      var ix = this.dragging.ix;
	      var iy = this.dragging.iy;

	      var c = undefined;

	      if (region == 'L') {
		if (ix > 0)
		  if (this.board[iy][ix - 1] == '.')
		    c = [iy, ix, 0];
	      }
	      else if (region == 'D') {
		if (iy < this.H - 1)
		  if (this.board[iy + 1][ix] == '.')
		    c = [iy, ix, 1];
	      }
	      else if (region == 'R') {
		if (ix < this.W - 1)
		  if (this.board[iy][ix + 1] == '.')
		    c = [iy, ix, 2];
	      }
	      else if (region == 'U') {
		if (iy > 0)
		  if (this.board[iy - 1][ix] == '.')
		    c = [iy, ix, 3];
	      }

	      if (!! c) {
		this.result.splice(this.step);
		this.cache .splice(this.step + 1);

		this.result.push(c);
		
		$(window).trigger($.Event('keypress', {which: 110}));
	      }
	      else {
		this.draw();
	      }
	    }
	    else {
	      this.draw();
	    }
	  }
	  else {
	    var dx = this.S.x - this.E.x;
	    var dy = this.S.y - this.E.y;
	    
	    var d = Math.sqrt(dx * dx + dy * dy);

	    var dp = $('#canvas').width();

	    if (region == 'L') {
	      if (d > dp * DRAGGING_THRESHOLD) {
		if (this.step == 0) {
		  this.draw();
		}
		else {
		  while (this.step)
		    $(window).trigger($.Event('keypress', {which: 112}));
		}
	      }
	      else {
		$(window).trigger($.Event('keypress', {which: 112}));
	      }
	    }
	    else if (region == 'R') {
	      if (d > dp * DRAGGING_THRESHOLD) {
		if (this.step == this.result.length) {
		  this.draw();
		}
		else {
		  while (this.step < this.result.length)
		    $(window).trigger($.Event('keypress', {which: 110}));
		}
	      }
	      else {
		$(window).trigger($.Event('keypress', {which: 110}));
	      }
	    }
	    else {
	      this.draw();
	    }
	  }
	}
      }
    }

    function score() {
      var H = this.H;
      var W = this.W;

      var board = this.cache[this.step];

      var target = this.target;

      var c1 = 0, c2 = 0;

      for (var i = 0; i < H; i ++)
	for (var j = 0; j < W; j ++) {
	  var c = board[i][j];

	  if ('0' <= c && c <= '9') {
	    if (board[i][j] == target[i][j]) {
	      c1 ++;
	    }
	    else if (target[i][j] != '.') {
	      c2 ++;
	    }
	  }
	}

      return [c1, c2];
    }

    function score_string() {
      var t = score.call(this);

      var c1 = t[0], c2 = t[1];

      return ((c1 + c2 * 0.5) / this.N + 1e-6 + '').substr(0, 5) +
	'(' + c1 + '/' + c2 + '/' + this.N + ')';
    }

    function step_string() {
      return this.step + '/' + this.result.length + '(' + (this.N * 20) + ')';
    }

    function make_editable(board) {
      var b = [];

      var H = this.H, W = this.W;

      for (var i = 0; i < H; i ++) {
	var row = [];
	
	for (var j = 0; j < W; j ++)
	  row.push(board[i][j]);
	
	b.push(row);
      }

      return b;
    }

    return {
      doit:          doit,
      draw:          draw,
      event:         event,
      on:            on,
      score:         score,
      score_string:  score_string,
      step_string:   step_string,
      make_editable: make_editable
    };
  })());
})(jQuery);
