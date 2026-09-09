/*
 * Original SudokuPad artwork renderer for sudokupad_to_penpa.
 * Copyright (c) 2026 cyddrdrd. Released under the MIT license.
 * Serialization and drawing conventions were independently implemented from
 * SudokuPad's public puzzle format and renderer. No upstream code is included.
 */
(function (root) {
  'use strict';

  const SOURCE_CELL = 64;
  const LAYERS = ['background', 'underlay', 'cell-colors', 'arrows', 'cages', 'cell-grids', 'overlay', 'notes'];
  const METADATA = new Set(['id', 'cellSize', 'cells', 'regions', 'cages', 'lines', 'arrows', 'underlays', 'overlays',
    'metadata', 'title', 'author', 'rules', 'solution', 'videos', 'settings', 'source', 'foglight', 'fogofwar',
    'solutionmessage', 'sudokupad', 'format', 'size', 'width', 'height', 'minDigit', 'maxDigit']);
  const COMMON = ['target', 'class', 'className', 'feature', 'opacity', 'fill-opacity', 'stroke-opacity',
    'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset'];
  const SHAPE_KEYS = new Set([...COMMON, 'center', 'width', 'height', 'angle', 'borderSize', 'thickness',
    'backgroundColor', 'borderColor', 'rounded', 'roundedRadius', 'text', 'fontSize', 'textColor', 'color',
    'textStroke', 'textAnchor', 'text-anchor', 'dominant-baseline', 'font-family', 'font-weight', 'font-style',
    'maxWidth', 'fill', 'stroke']);
  const LINE_KEYS = new Set([...COMMON, 'color', 'thickness', 'wayPoints', 'd', 'fill', 'stroke']);
  const ARROW_KEYS = new Set([...LINE_KEYS, 'headLength', 'headStyle', 'headAngle', 'headIndent']);
  const CAGE_KEYS = new Set(['cells', 'value', 'style', 'type', 'hidden', 'unique', 'sum', 'feature',
    'fontC', 'outlineC', 'textColor', 'borderColor', 'cageValue']);

  function fail(message) { throw new Error('Artwork: ' + message); }
  function num(value, label, fallback) {
    if (value === undefined && fallback !== undefined) return fallback;
    const result = Number(value);
    if (!Number.isFinite(result) || Math.abs(result) > 100000) fail(label + ' must be a finite number.');
    return result;
  }
  function nonnegative(value, label, fallback) {
    const result = num(value, label, fallback);
    if (result < 0) fail(label + ' must not be negative.');
    return result;
  }
  function opacity(value, fallback = 1) {
    const result = num(value, 'opacity', fallback);
    if (result < 0 || result > 1) fail('opacity must be between 0 and 1.');
    return result;
  }
  function esc(value) {
    return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;'}[ch]));
  }
  function decimal(value) { return String(Math.round(value * 10000) / 10000); }
  function attrs(values) {
    return Object.entries(values).filter(([,value]) => value !== undefined)
      .map(([key,value]) => ' ' + key + '="' + esc(typeof value === 'number' ? decimal(value) : value) + '"').join('');
  }
  function element(name, attributes, text) {
    return '<' + name + attrs(attributes) + (text === undefined ? '/>' : '>' + text + '</' + name + '>');
  }
  function paint(value, fallback = 'none') {
    if (value === undefined || value === '') return fallback;
    if (typeof value !== 'string') fail('a color must be a string.');
    const color = value.trim();
    if (/^(?:none|transparent|currentColor)$/i.test(color)) return color === 'currentColor' ? '#000000' : color;
    if (/^#[0-9a-f]{3,4}(?:[0-9a-f]{3,4})?$/i.test(color) && [4,5,7,9].includes(color.length)) return color;
    if (/^[a-z]+$/i.test(color)) return color;
    if (/^(?:rgb|hsl)a?\(\s*[-+.\d%\s,\/]+(?:deg|rad|turn)?[-+.\d%\s,\/]*\)$/i.test(color)) return color;
    fail('unsupported or unsafe color: ' + color.slice(0, 60));
  }
  function rc(point, label) {
    if (!Array.isArray(point) || point.length !== 2) fail(label + ' must contain a row and column.');
    return [num(point[0], label + ' row'), num(point[1], label + ' column')];
  }
  function list(value, label) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > 100000) fail(label + ' must be a reasonable list.');
    return value;
  }
  function pathData(points, close = false) {
    return points.map(([x,y],i) => (i ? 'L' : 'M') + decimal(x) + ' ' + decimal(y)).join(' ') + (close ? ' Z' : '');
  }
  function gridEdgeOccluded(boxes, x1, y1, x2, y2) {
    return boxes.some(box => Math.max(x1,x2) >= box.left-2 && Math.min(x1,x2) <= box.right+2 &&
      Math.max(y1,y2) >= box.top-2 && Math.min(y1,y2) <= box.bottom+2);
  }
  function visiblePaint(color) {
    return !/^(?:none|transparent|#[0-9a-f]{3}0|#[0-9a-f]{6}00|rgba\([^)]*[,/]\s*0(?:\.0+)?\s*\))$/i.test(color);
  }

  // Follow the exposed clockwise edges of a union of square cells, then move
  // each contour inward. This also handles holes and disconnected cage pieces.
  function outlines(cells, inset = 0) {
    const occupied = new Set(cells.map(([r,c]) => r + ',' + c));
    const edges = new Map();
    function add(x, y, xx, yy, direction) {
      const key = x + ',' + y;
      if (!edges.has(key)) edges.set(key, []);
      edges.get(key).push({x, y, xx, yy, direction});
    }
    for (const key of occupied) {
      const [r,c] = key.split(',').map(Number);
      if (!occupied.has((r-1)+','+c)) add(c,r,c+1,r,0);
      if (!occupied.has(r+','+(c+1))) add(c+1,r,c+1,r+1,1);
      if (!occupied.has((r+1)+','+c)) add(c+1,r+1,c,r+1,2);
      if (!occupied.has(r+','+(c-1))) add(c,r+1,c,r,3);
    }
    const polygons = [];
    while (edges.size) {
      let edge = edges.values().next().value[0];
      const start = [edge.x, edge.y], points = [];
      for (let guard=0; guard <= occupied.size*4; guard++) {
        points.push([edge.x, edge.y]);
        const key = edge.x+','+edge.y, bucket = edges.get(key);
        bucket.splice(bucket.indexOf(edge),1);
        if (!bucket.length) edges.delete(key);
        if (edge.xx === start[0] && edge.yy === start[1]) break;
        const choices = edges.get(edge.xx+','+edge.yy);
        if (!choices || !choices.length) fail('a cage boundary is not closed.');
        const order = [1,0,3,2];
        edge = choices.slice().sort((a,b) => order.indexOf((a.direction-edge.direction+4)%4)
          - order.indexOf((b.direction-edge.direction+4)%4))[0];
      }
      const shifted = points.map((point,i) => {
        const prev = points[(i+points.length-1)%points.length], next = points[(i+1)%points.length];
        const dx1=point[0]-prev[0],dy1=point[1]-prev[1],dx2=next[0]-point[0],dy2=next[1]-point[1];
        const l1=Math.hypot(dx1,dy1),l2=Math.hypot(dx2,dy2);
        const n1=[-dy1/l1,dx1/l1],n2=[-dy2/l2,dx2/l2];
        const dot=n1[0]*n2[0]+n1[1]*n2[1], divisor=1+dot;
        return [(point[0]+inset*(n1[0]+n2[0])/divisor)*SOURCE_CELL,
          (point[1]+inset*(n1[1]+n2[1])/divisor)*SOURCE_CELL];
      });
      polygons.push(shifted);
    }
    return polygons;
  }

  function render(puzzle, options = {}) {
    if (!puzzle || typeof puzzle !== 'object') fail('missing puzzle.');
    const rows = list(puzzle.cells, 'cells').length;
    const cols = Math.max(0, ...puzzle.cells.map(row => list(row, 'cell row').length));
    if (rows < 1 || cols < 1 || rows > 100 || cols > 100) fail('grid dimensions must be between 1 and 100.');
    const cellSize = num(options.cellSize, 'cell size', 38);
    if (cellSize < 10 || cellSize > 100) fail('cell size must be between 10 and 100.');
    const warnings = [], warned = new Set(), layers = Object.fromEntries(LAYERS.map(layer => [layer, []]));
    const bounds = {left:0,top:0,right:cols*SOURCE_CELL,bottom:rows*SOURCE_CELL}, gridOcclusions = [], cageOcclusions = [], artworkOcclusions = [];
    let captureArtwork = false;
    function protectArtwork(draw) {
      captureArtwork = true;
      try { draw(); } finally { captureArtwork = false; }
    }
    function warn(message) { if (!warned.has(message)) { warned.add(message); warnings.push(message); } }
    function box(x,y,width,height,pad=0,layer) {
      bounds.left=Math.min(bounds.left,x-pad); bounds.top=Math.min(bounds.top,y-pad);
      bounds.right=Math.max(bounds.right,x+width+pad); bounds.bottom=Math.max(bounds.bottom,y+height+pad);
      if (layer === 'overlay' || layer === 'notes') {
        gridOcclusions.push({left:x-pad,top:y-pad,right:x+width+pad,bottom:y+height+pad});
      }
      // Retargeted shapes and arrowheads can also cover source lines. Keep
      // intersecting lines in the artwork so promotion cannot reveal them.
      if (captureArtwork && layer && LAYERS.indexOf(layer) >= LAYERS.indexOf('arrows')) {
        artworkOcclusions.push({left:x-pad,top:y-pad,right:x+width+pad,bottom:y+height+pad});
      }
    }
    function append(layer, markup) {
      if (!LAYERS.includes(layer)) fail('unsupported drawing layer: ' + layer);
      layers[layer].push(markup);
    }
    function pointBox(points,pad,layer) {
      let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
      for(const [x,y] of points) {left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
      box(left,top,right-left,bottom-top,pad,layer);
    }
    function validate(object, allowed, label) {
      if (!object || typeof object !== 'object' || Array.isArray(object)) fail(label + ' must be an object.');
      for (const key of Object.keys(object)) {
        // Cage style is a named puzzle convention checked by cage(), never CSS.
        if (/^(?:on|href$|xlink:|src$|style$|transform$|filter$|mask$|clip-path$)/i.test(key) &&
          !(key === 'style' && allowed === CAGE_KEYS)) fail(label + ' contains unsupported SVG attribute ' + key + '.');
        if (!allowed.has(key)) warn(label + ': unsupported property “' + key + '” was not applied.');
      }
    }
    function strokeOptions(part, fallbackWidth=1) {
      const out = {'stroke-width':nonnegative(part['stroke-width'] ?? part.thickness, 'line width',fallbackWidth)};
      for (const [key,valid] of [['stroke-linecap',['butt','round','square']],['stroke-linejoin',['miter','round','bevel']]]) {
        if (part[key] !== undefined) {
          if (!valid.includes(part[key])) fail('unsupported '+key+'.');
          out[key]=part[key];
        }
      }
      if (part['stroke-dasharray'] !== undefined) {
        const dash=String(part['stroke-dasharray']);
        if (!/^(?:none|[\d.\s,]+)$/.test(dash)) fail('invalid dash pattern.');
        out['stroke-dasharray']=dash;
      }
      if (part['stroke-dashoffset'] !== undefined) out['stroke-dashoffset']=num(part['stroke-dashoffset'],'dash offset');
      if (part['fill-opacity'] !== undefined) out['fill-opacity']=opacity(part['fill-opacity']);
      if (part['stroke-opacity'] !== undefined) out['stroke-opacity']=opacity(part['stroke-opacity']);
      out.opacity=opacity(part.opacity);
      return out;
    }
    function text(part, layer, legacyFont = true, native = false) {
      const [r,c]=rc(part.center,'text position');
      const h=num(part.height,'text height',1), x=c*SOURCE_CELL, y=(r+.06*h)*SOURCE_CELL;
      const font=nonnegative(part.fontSize,'font size',24)+(legacyFont && part.fontSize!==undefined?4:0);
      if (!font) return;
      const value=String(part.text ?? ''), lines=value.split(/\r?\n/);
      if (!value.trim()) return;
      const anchor=part.textAnchor ?? part['text-anchor'] ?? 'middle';
      if (!['start','middle','end'].includes(anchor)) fail('invalid text anchor.');
      const baseline=part['dominant-baseline'] ?? 'middle';
      if (!['middle','central','alphabetic','hanging','text-before-edge','text-after-edge','auto'].includes(baseline)) fail('invalid text baseline.');
      const maxWidth=part.maxWidth===undefined?undefined:nonnegative(part.maxWidth,'maximum text width');
      // Plain Arial digits and question marks advance about .556 em. A .6 em
      // estimate keeps outside numeric clues from falsely masking the frame;
      // retain the more conservative width for other text, fonts and styles.
      const plainNumeric=/^[0-9?\r\n]+$/.test(value) && part['font-family']===undefined &&
        [undefined,'normal',400,'400'].includes(part['font-weight']) &&
        [undefined,'normal'].includes(part['font-style']);
      const estimatedWidth=Math.max(...lines.map(line => [...line].reduce((total,ch)=>total+
        (plainNumeric?.6:/[\u0000-\u00ff]/.test(ch)?.75:1),0)))*font;
      const width=maxWidth===undefined?estimatedWidth:Math.min(estimatedWidth,maxWidth), height=font*lines.length*1.2;
      const left=anchor==='start'?x:anchor==='end'?x-width:x-width/2;
      const angle=num(part.angle,'text rotation',0);
      const textFill=paint(part.textColor ?? part.color ?? part.fill,'#000000'),textStroke=paint(part.textStroke ?? part.stroke,'#ffffff');
      const visibleLayer=!native && opacity(part.opacity)>0 && (visiblePaint(textFill)||visiblePaint(textStroke))?layer:undefined;
      // Alphabetic labels end at their baseline; treating it as their centre
      // can incorrectly mark the next row's grid edge as covered by text.
      const top=y-(baseline==='alphabetic'||baseline==='auto'?font+(lines.length-1)*font*.6:
        baseline==='hanging'||baseline==='text-before-edge'?(lines.length-1)*font*.6:
        baseline==='text-after-edge'?font*1.2+(lines.length-1)*font*.6:height/2);
      if (angle) {
        const radians=angle*Math.PI/180,cos=Math.cos(radians),sin=Math.sin(radians);
        pointBox([[left,top],[left+width,top],[left+width,top+height],[left,top+height]].map(([xx,yy])=>
          [x+(xx-x)*cos-(yy-y)*sin,y+(xx-x)*sin+(yy-y)*cos]),font*.1,visibleLayer);
      } else box(left,top,width,height,font*.1,visibleLayer);
      const attributes={x,y,fill:textFill,
        'font-family':'Arial, Helvetica, sans-serif','font-size':font,'text-anchor':anchor,'dominant-baseline':baseline,
        stroke:textStroke,'stroke-width':part.textStroke==='none'?0:2,
        'paint-order':'stroke fill','stroke-linejoin':'round',opacity:opacity(part.opacity)};
      if (part['font-family'] !== undefined) {
        if (!/^[\w\s,'"-]+$/.test(part['font-family'])) fail('invalid font family.');
        attributes['font-family']=part['font-family'];
      }
      if (part['font-weight']!==undefined) {
        if (!/^(?:normal|bold|[1-9]00)$/.test(String(part['font-weight']))) fail('invalid font weight.');
        attributes['font-weight']=part['font-weight'];
      }
      if (part['font-style']!==undefined) {
        if (!['normal','italic','oblique'].includes(part['font-style'])) fail('invalid font style.');
        attributes['font-style']=part['font-style'];
      }
      if (angle) attributes.transform='rotate('+decimal(angle)+' '+decimal(x)+' '+decimal(y)+')';
      if (maxWidth!==undefined && estimatedWidth>maxWidth) {attributes.textLength=maxWidth;attributes.lengthAdjust='spacingAndGlyphs';}
      const content=lines.length===1?esc(value):lines.map((line,i)=>element('tspan',{x,dy:i?font*1.2:-(lines.length-1)*font*.6},esc(line))).join('');
      if (!native) append(layer,element('text',attributes,content));
    }
    function shape(part, defaultLayer, nativeText = false) {
      validate(part,SHAPE_KEYS,'shape');
      const layer=part.target ?? defaultLayer;
      const [r,c]=rc(part.center,'shape center'), w=nonnegative(part.width,'shape width',1)*SOURCE_CELL,
        h=nonnegative(part.height,'shape height',1)*SOURCE_CELL;
      const border=paint(part.borderColor ?? part.stroke),fill=paint(part.backgroundColor ?? part.fill);
      const stroke=border===fill?'none':border;
      const lineWidth=nonnegative(part.borderSize || part.thickness || part['stroke-width'],'border width',stroke!=='none'?2:0);
      const angle=num(part.angle,'shape rotation',0), cx=c*SOURCE_CELL,cy=r*SOURCE_CELL;
      const rw=Math.max(0,w-lineWidth),rh=Math.max(0,h-lineWidth);
      const attributes={x:cx-rw/2,y:cy-rh/2,width:rw,height:rh,fill,stroke,...strokeOptions(part,lineWidth),'stroke-width':lineWidth};
      // SudokuPad's legacy opaque color exception keeps gray bulbs and white masks solid.
      const alpha=/^#(?:[0-9a-f]{4}|[0-9a-f]{8})$/i.test(fill)||/^(?:rgba|hsla)\(/i.test(fill);
      const opaque=['#000000','#CFCFCF','#FFFFFF','none'].includes(fill);
      if (!alpha && !opaque) {
        if (part['fill-opacity']===undefined) attributes['fill-opacity']=.5;
        if (part['stroke-opacity']===undefined) attributes['stroke-opacity']=.5;
      }
      if (part.rounded) {
        const radius=part.roundedRadius===undefined?Math.min(rw,rh)/2:nonnegative(part.roundedRadius,'corner radius');
        attributes.rx=radius;attributes.ry=radius;
      }
      const visibleLayer=w&&h&&attributes.opacity>0 &&
        ((visiblePaint(fill) && (attributes['fill-opacity']??1)>0) ||
          (lineWidth>0 && visiblePaint(stroke) && (attributes['stroke-opacity']??1)>0))?layer:undefined;
      if (angle) {
        attributes.transform='rotate('+decimal(angle)+' '+decimal(cx)+' '+decimal(cy)+')';
        const radians=angle*Math.PI/180, bw=Math.abs(w*Math.cos(radians))+Math.abs(h*Math.sin(radians)),bh=Math.abs(w*Math.sin(radians))+Math.abs(h*Math.cos(radians));
        box(cx-bw/2,cy-bh/2,bw,bh,lineWidth/2,visibleLayer);
      } else box(cx-w/2,cy-h/2,w,h,lineWidth/2,visibleLayer);
      if (w&&h) append(layer,element('rect',attributes));
      if (part.text!==undefined && part.text!=='') text({...part,backgroundColor:undefined,stroke:undefined,fill:undefined},layer,true,nativeText);
    }
    // SVG path data is geometry only: no markup, URLs, CSS, or executable
    // attributes enter the result. Parse every command to validate its arity and
    // include control points in conservative outside-clue bounds.
    function rawPath(value, thickness, layer) {
      const pathBounds={left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity};
      function pathBox(x,y,width,height,pad) {
        box(x,y,width,height,pad);
        pathBounds.left=Math.min(pathBounds.left,x-pad);pathBounds.top=Math.min(pathBounds.top,y-pad);
        pathBounds.right=Math.max(pathBounds.right,x+width+pad);pathBounds.bottom=Math.max(pathBounds.bottom,y+height+pad);
      }
      if (typeof value!=='string'||value.length>1000000) fail('invalid SVG path data.');
      const tokenPattern=/[MLHVCSQTAZmlhvcsqtaz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;
      const tokens=value.match(tokenPattern)||[];
      if(value.replace(tokenPattern,'').replace(/[\s,]/g,'')!=='')fail('unsupported characters in SVG path data.');
      const arities={M:2,L:2,H:1,V:1,C:6,S:4,Q:4,T:2,A:7};
      let i=0,x=0,y=0,startX=0,startY=0,command,lastControl,lastKind;
      if(!/^[Mm]$/.test(tokens[0]??''))fail('SVG paths must begin with a move command.');
      while(i<tokens.length) {
        if(/^[A-Za-z]$/.test(tokens[i]))command=tokens[i++];
        else if(!command)fail('SVG path is missing a command.');
        const kind=command.toUpperCase(),relative=command!==kind;
        if(kind==='Z'){x=startX;y=startY;command=undefined;lastControl=undefined;lastKind='Z';continue;}
        const arity=arities[kind];
        if(!arity||i+arity>tokens.length)fail('SVG path has incomplete command data.');
        const args=tokens.slice(i,i+arity).map(token=>{
          if(/^[A-Za-z]$/.test(token))fail('SVG path has incomplete command data.');
          return num(token,'SVG path coordinate');
        });
        i+=arity;
        const oldX=x,oldY=y,px=relative?x:0,py=relative?y:0;
        if ((kind==='S'&&['C','S'].includes(lastKind))||(kind==='T'&&['Q','T'].includes(lastKind))) {
          pathBox(2*x-lastControl[0],2*y-lastControl[1],0,0,thickness*2);
        }
        if(kind==='H')x=px+args[0];
        else if(kind==='V')y=py+args[0];
        else if(kind==='A') {
          if(args[0]<0||args[1]<0||![0,1].includes(args[3])||![0,1].includes(args[4]))fail('invalid SVG arc parameters.');
          const endX=px+args[5],endY=py+args[6];
          let radiusX=args[0],radiusY=args[1];
          if(radiusX&&radiusY&&(x!==endX||y!==endY)) {
            const phi=args[2]*Math.PI/180,cos=Math.cos(phi),sin=Math.sin(phi);
            const dx=(x-endX)/2,dy=(y-endY)/2,localX=cos*dx+sin*dy,localY=-sin*dx+cos*dy;
            const stretch=Math.sqrt(Math.max(1,(localX/radiusX)**2+(localY/radiusY)**2));
            radiusX*=stretch;radiusY*=stretch;
            const denominator=radiusX**2*localY**2+radiusY**2*localX**2;
            const coefficient=(args[3]===args[4]?-1:1)*Math.sqrt(Math.max(0,(radiusX**2*radiusY**2-denominator)/denominator));
            const localCX=coefficient*radiusX*localY/radiusY,localCY=-coefficient*radiusY*localX/radiusX;
            const centerX=cos*localCX-sin*localCY+(x+endX)/2,centerY=sin*localCX+cos*localCY+(y+endY)/2;
            const extentX=Math.hypot(radiusX*cos,radiusY*sin),extentY=Math.hypot(radiusX*sin,radiusY*cos);
            pathBox(centerX-extentX,centerY-extentY,2*extentX,2*extentY,thickness*2);
          }
          x=endX;y=endY;
        } else {
          for(let a=0;a<args.length;a+=2)pathBox(px+args[a],py+args[a+1],0,0,thickness*2);
          x=px+args[args.length-2];y=py+args[args.length-1];
          if(kind==='M'){startX=x;startY=y;command=relative?'l':'L';}
        }
        pathBox(x,y,0,0,thickness*2);
        if(kind==='C'||kind==='S')lastControl=[px+args[args.length-4],py+args[args.length-3]];
        else if(kind==='Q')lastControl=[px+args[0],py+args[1]];
        else if(kind==='T')lastControl=lastControl&&['Q','T'].includes(lastKind)?[2*oldX-lastControl[0],2*oldY-lastControl[1]]:[oldX,oldY];
        else lastControl=undefined;
        lastKind=kind;
      }
      if(!tokens.length)fail('empty SVG path data.');
      if(layer==='overlay'||layer==='notes')gridOcclusions.push(pathBounds);
      return tokens.join(' ');
    }
    function line(part, arrow=false, native=false) {
      // Some published puzzles interleave author labels with their lines.
      // SudokuPad treats those strings as empty drawing entries.
      if (!arrow && typeof part === 'string') return;
      validate(part,arrow?ARROW_KEYS:LINE_KEYS,arrow?'arrow':'line');
      const appendLine=(layer,markup)=>{if(!native)append(layer,markup);};
      const layer=part.target ?? 'arrows', points=list(part.wayPoints,'line waypoints').map((point)=>{const [r,c]=rc(point,'waypoint');return [c*SOURCE_CELL,r*SOURCE_CELL];});
      if (!points.length) {
        if (part.d) {
          if(arrow)fail('arrows require wayPoints rather than raw SVG path data.');
          const options=strokeOptions(part,1),thickness=options['stroke-width'];
          const fill=paint(part.fill),stroke=paint(part.color??part.stroke);
          const visibleLayer=!native && options.opacity>0 && ((visiblePaint(fill)&&(options['fill-opacity']??1)>0)||
            (thickness>0&&visiblePaint(stroke)&&(options['stroke-opacity']??1)>0))?layer:undefined;
          appendLine(layer,element('path',{fill,stroke,'stroke-linecap':'round','stroke-linejoin':'round',...options,d:rawPath(part.d,thickness,visibleLayer)}));
          return;
        }
        warn('An empty '+(arrow?'arrow':'line')+' was ignored.');return;
      }
      if (points.length<2) {warn('A '+(arrow?'arrow':'line')+' with fewer than two points was ignored.');return;}
      const color=paint(part.color ?? part.stroke),options=strokeOptions(part,1);
      // The player widens legacy one-pixel free lines to two pixels.
      if (!arrow && part.thickness===1 && part['stroke-width']===undefined) options['stroke-width']=2;
      const thickness=options['stroke-width'];
      const common={fill:paint(part.fill),stroke:color,'stroke-linecap':arrow?'butt':'round','stroke-linejoin':'round',...options};
      const visibleLayer=!native && options.opacity>0 && ((visiblePaint(common.fill)&&(options['fill-opacity']??1)>0)||
        (thickness>0&&visiblePaint(color)&&(options['stroke-opacity']??1)>0))?layer:undefined;
      pointBox(points,thickness*2,visibleLayer);
      if (!arrow) {appendLine(layer,element('path',{...common,d:pathData(points)}));return;}
      const style=part.headStyle ?? 'stroke';
      if (!['stroke','fill'].includes(style)) fail('unsupported arrowhead style '+style+'.');
      const angle=num(part.headAngle,'arrowhead angle',90);
      if (angle<=0||angle>=180) fail('arrowhead angle must be between 0 and 180.');
      const length=part.headLength===undefined?thickness*5:nonnegative(part.headLength,'arrowhead length')*SOURCE_CELL;
      const indent=num(part.headIndent,'arrowhead indent',0);
      if(indent<0||indent>1) fail('arrowhead indent must be between 0 and 1.');
      let end=points[points.length-1],before=points[points.length-2],distance=Math.hypot(end[0]-before[0],end[1]-before[1]);
      if(!distance) {warn('An arrow with coincident final points was ignored.');return;}
      const unit=[(end[0]-before[0])/distance,(end[1]-before[1])/distance],halfAngle=angle*Math.PI/360;
      const back=length*Math.cos(halfAngle),side=length*Math.sin(halfAngle);
      // Open arrowheads end one stroke width short, matching SudokuPad's markers.
      const tip=style==='stroke'?[end[0]-unit[0]*thickness,end[1]-unit[1]*thickness]:end;
      const left=[tip[0]-unit[0]*back-unit[1]*side,tip[1]-unit[1]*back+unit[0]*side],right=[tip[0]-unit[0]*back+unit[1]*side,tip[1]-unit[1]*back-unit[0]*side];
      const stemEnd=style==='fill'?[end[0]-unit[0]*Math.max(0,back*(1-indent)-.5),end[1]-unit[1]*Math.max(0,back*(1-indent)-.5)]:tip;
      appendLine(layer,element('path',{...common,d:pathData([...points.slice(0,-1),stemEnd])}));
      const head=style==='fill'?[left,tip,right,[tip[0]-unit[0]*back*(1-indent),tip[1]-unit[1]*back*(1-indent)]]:[left,tip,right];
      pointBox(head,thickness*2,visibleLayer);
      appendLine(layer,element('path',{...common,'stroke-linejoin':'miter',fill:style==='fill'?color:'none','stroke-width':style==='fill'?0:thickness,d:pathData(head,style==='fill')}));
    }
    function cellList(value,label) {
      return list(value,label).map((point)=>{const [r,c]=rc(point,label);if(!Number.isInteger(r)||!Number.isInteger(c))fail(label+' cells must use integer coordinates.');return[r,c];});
    }
    function cage(part, region=false) {
      if(!region)validate(part,CAGE_KEYS,'cage');
      const entries=region?part:part.cells;
      const cells=cellList(region?list(entries,'region').filter(item=>Array.isArray(item)):entries,'cage');
      if(!cells.length){if(!region)warn('An empty cage was ignored.');return;}
      if(part.hidden===true)return;
      const type=region?'box':part.style??(['rowcol','disjoint'].includes(part.type)?'hidden':'killer');
      // Cage outlines, fills and their white label backgrounds are painted
      // above ordinary source lines. Do not promote a line through them.
      if(!region && (type!=='hidden'&&type!=='' || String(part.value??'').trim())) {
        for(const [r,c] of cells)cageOcclusions.push({left:c*SOURCE_CELL,top:r*SOURCE_CELL,
          right:(c+1)*SOURCE_CELL,bottom:(r+1)*SOURCE_CELL});
      }
      const styles={killer:{inset:.08,stroke:'#000000',width:1.5,dash:'5 3'},box:{inset:0,stroke:'#000000',width:3},
        windoku:{inset:.08,fill:'#cfcfcf33',width:0},extraregion:{inset:.09375,fill:'rgba(178,178,178,0.4)',width:0},
        fpRowIndexer:{inset:.0390625,fill:'#7CC77C33',stroke:'#7CC77C',width:4},
        fpColumnIndexer:{inset:.0390625,fill:'#C77C7C33',stroke:'#C77C7C',width:4},
        fpBoxIndexer:{inset:.0390625,fill:'#7C7CC733',stroke:'#7C7CC7',width:4}};
      const layer=type==='box'?'cell-grids':'cages';
      if(!['hidden','',undefined].includes(type)) {
        if(typeof type!=='string'||!Object.prototype.hasOwnProperty.call(styles,type))fail('unsupported cage style '+type+'.');
        const style=styles[type];
        const polygons=outlines(cells,style.inset);
        const attributes={d:polygons.map(points=>pathData(points,true)).join(' '),fill:paint(style.fill),stroke:paint(part.borderColor??part.outlineC??style.stroke),
          'stroke-width':style.width,'stroke-dasharray':style.dash,'stroke-linejoin':'round','fill-rule':'evenodd'};
        for(const points of polygons)for(const [x,y]of points)box(x,y,0,0,style.width);
        append(layer,element('path',attributes));
      }
      if(region||part.value===undefined||/^\s*$/.test(String(part.value)))return;
      const [r,c]=cells.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1])[0];
      let span=1;while(cells.some(([rr,cc])=>rr===r&&cc===c+span))span++;
      const font=13,label=String(part.value),labelWidth=Math.min((span-.07)*SOURCE_CELL,label.length*font*.75);
      append(layer,element('rect',{x:(c+.02)*SOURCE_CELL,y:(r+.05)*SOURCE_CELL,width:labelWidth+2,height:font,fill:'rgba(255,255,255,0.9)'}));
      text({center:[r+.15,c+.035],height:.2,text:label,fontSize:font,textAnchor:'start',textColor:part.textColor??part.fontC,
        textStroke:'none',maxWidth:(span-.07)*SOURCE_CELL},layer,false);
    }

    for(const key of Object.keys(puzzle)) if(!METADATA.has(key)) warn('Unsupported puzzle property “'+key+'” was not applied to its artwork.');
    for(const [key,value]of Object.entries(puzzle.settings??{})) if(['hidecolours','hidecages','hidegivens','darkmode','outlinesonlines','largedigits'].includes(key)&&![false,0,'0',null,undefined].includes(value))warn('The SudokuPad drawing setting “'+key+'” has no artwork equivalent in Penpa.');
    if(puzzle.foglight?.length||puzzle.fogofwar?.length)fail('dynamic fog cannot be represented by a static Penpa puzzle.');
    list(puzzle.underlays,'underlays').forEach((part,index)=>protectArtwork(()=>shape(part,'underlay',options.nativeUnderlayText?.has(index))));
    for(let r=0;r<rows;r++)for(let c=0;c<(puzzle.cells[r]||[]).length;c++) {
      const cell=puzzle.cells[r][c]??{};
      if(typeof cell!=='object')fail('each cell must be an object.');
      for(const key of Object.keys(cell))if(!['value','given','pencilMarks','centremarks','candidates','color','backgroundColor','highlight'].includes(key))warn('Unsupported cell property “'+key+'” was not applied.');
      if(cell.backgroundColor||cell.color)append('cell-colors',element('rect',{x:c*SOURCE_CELL,y:r*SOURCE_CELL,width:SOURCE_CELL,height:SOURCE_CELL,fill:paint(cell.backgroundColor??cell.color)}));
      if(cell.highlight)warn('Cell highlight markers are not converted.');
      const centre=cell.centremarks??cell.candidates;
      if(Array.isArray(centre)&&centre.length)text({center:[r+.5,c+.5],text:centre.join(''),fontSize:18,textStroke:'#ffffff',maxWidth:SOURCE_CELL*.85},'notes',false);
      if(Array.isArray(cell.pencilMarks)&&cell.pencilMarks.length) {
        const marks=cell.pencilMarks;
        marks.forEach((mark,i)=>text({center:[r+.17+Math.floor(i/3)*.28,c+.17+(i%3)*.33],text:mark,fontSize:16,textStroke:'#ffffff'},'notes',false));
      }
    }
    if ([true,1,'1','true'].includes(puzzle.settings?.arrowsabovelines)) {
      list(puzzle.lines,'lines').forEach((part,index)=>line(part,false,options.nativeLineIndices?.has(index)));
      for(const part of list(puzzle.arrows,'arrows'))protectArtwork(()=>line(part,true));
    } else {
      for(const part of list(puzzle.arrows,'arrows'))protectArtwork(()=>line(part,true));
      list(puzzle.lines,'lines').forEach((part,index)=>line(part,false,options.nativeLineIndices?.has(index)));
    }
    for(const part of list(puzzle.cages,'cages'))cage(part);
    const grid=[];
    for(let r=0;r<=rows;r++)grid.push(pathData([[0,r*SOURCE_CELL],[cols*SOURCE_CELL,r*SOURCE_CELL]]));
    for(let c=0;c<=cols;c++)grid.push(pathData([[c*SOURCE_CELL,0],[c*SOURCE_CELL,rows*SOURCE_CELL]]));
    const gridVisible=![true,1,'1','true'].includes(puzzle.settings?.nogrid),gridLayerIndex=layers['cell-grids'].length;
    for(const region of list(puzzle.regions,'regions'))cage(region,true);
    list(puzzle.overlays,'overlays').forEach((part,index)=>protectArtwork(()=>shape(part,'overlay',options.nativeOverlayText?.has(index))));
    if (gridVisible) {
      if (options.nativeGrid) {
        // Penpa redraws these edges over surface fills. Keep masked edges in
        // the image instead so native lines cannot cut through clue artwork.
        grid.length=0;
        const edge=(x1,y1,x2,y2)=>{
          if(gridEdgeOccluded(gridOcclusions,x1,y1,x2,y2))grid.push(pathData([[x1,y1],[x2,y2]]));
        };
        for(let r=0;r<=rows;r++)for(let c=0;c<cols;c++)edge(c*SOURCE_CELL,r*SOURCE_CELL,(c+1)*SOURCE_CELL,r*SOURCE_CELL);
        for(let c=0;c<=cols;c++)for(let r=0;r<rows;r++)edge(c*SOURCE_CELL,r*SOURCE_CELL,c*SOURCE_CELL,(r+1)*SOURCE_CELL);
      }
      if(grid.length)layers['cell-grids'].splice(gridLayerIndex,0,element('path',{d:grid.join(' '),fill:'none',stroke:'#000000','stroke-width':1,
        'stroke-dasharray':[true,1,'1','true'].includes(puzzle.settings?.dashedgrid)?'3 10':undefined}));
    }

    // Fit each side independently. Penpa places a grid point at the canvas
    // center, so snap the artwork midpoint to its half-cell point lattice.
    // Keep it within the points Penpa creates, even for very distant artwork.
    function axisLayout(start,end,cells) {
      const left=Math.min(-.5,start/SOURCE_CELL-.25),right=Math.max(cells+.5,end/SOURCE_CELL+.25);
      const center=Math.max(-1.5,Math.min(cells+2,Math.round(left+right)/2));
      return {center,length:Math.ceil(2*Math.max(center-left,right-center)*cellSize)};
    }
    const horizontal=axisLayout(bounds.left,bounds.right,cols),vertical=axisLayout(bounds.top,bounds.bottom,rows);
    const width=horizontal.length,height=vertical.length,centerX=horizontal.center,centerY=vertical.center;
    if(width>10000||height>10000||width*height>16000000)fail('drawing dimensions are too large.');
    const marginX=(width/cellSize-cols-1)/2,marginY=(height/cellSize-rows-1)/2;
    const originX=width/2-centerX*cellSize+.5,originY=height/2-centerY*cellSize+.5;
    const content=LAYERS.map(layer=>element('g',{'data-layer':layer},layers[layer].join(''))).join('');
    const svg=element('svg',{xmlns:'http://www.w3.org/2000/svg',width:width*2.5,height:height*2.5,viewBox:'0 0 '+width+' '+height},
      element('g',{transform:'translate('+decimal(originX)+' '+decimal(originY)+') scale('+decimal(cellSize/SOURCE_CELL)+')'},content));
    return {svg,width,height,marginX,marginY,centerX,centerY,gridOcclusions,
      lineOcclusions:[...gridOcclusions,...cageOcclusions,...artworkOcclusions],warnings};
  }
  const api={render,gridEdgeOccluded};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.SudokuPadArtwork=api;
})(typeof globalThis!=='undefined'?globalThis:this);
