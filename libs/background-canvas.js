class BackgroundCanvas extends HTMLElement {
	constructor() {
		super();

		this.repaint = () => this.onDraw(this.gl);

		this.onInit = (gl) => {
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

			// Vertex shader
			const vertexShader = gl.createShader(gl.VERTEX_SHADER);
			gl.shaderSource(vertexShader, `
				attribute vec4 a_Position;
				void main() {
					gl_Position = a_Position;
				}
			`);
			gl.compileShader(vertexShader);
			if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS))
				throw "could not compile vertex shader:" + gl.getShaderInfoLog(vertexShader);
			
			// Fragment shader
			const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
			gl.shaderSource(fragmentShader, `
				precision mediump float;

				uniform float width, height, dpi, time;
				uniform vec2 scroll;

				const float patternSize = 5.0;
				const float patternSpacing = 8.0;
				const float noiseZoom = 500.0;

				const float cellSize = patternSpacing + patternSize;

				// Noise
				vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
				vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
				vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
				vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
				vec3 fade(vec3 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }
				float noise(vec3 P) {
				    vec3 i0 = mod289(floor(P)), i1 = mod289(i0 + vec3(1.0));
				    vec3 f0 = fract(P), f1 = f0 - vec3(1.0), f = fade(f0);
				    vec4 ix = vec4(i0.x, i1.x, i0.x, i1.x), iy = vec4(i0.yy, i1.yy);
				    vec4 iz0 = i0.zzzz, iz1 = i1.zzzz;
				    vec4 ixy = permute(permute(ix) + iy), ixy0 = permute(ixy + iz0), ixy1 = permute(ixy + iz1);
				    vec4 gx0 = ixy0 * (1.0 / 7.0), gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
				    vec4 gx1 = ixy1 * (1.0 / 7.0), gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
				    gx0 = fract(gx0); gx1 = fract(gx1);
				    vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0), sz0 = step(gz0, vec4(0.0));
				    vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1), sz1 = step(gz1, vec4(0.0));
				    gx0 -= sz0 * (step(0.0, gx0) - 0.5); gy0 -= sz0 * (step(0.0, gy0) - 0.5);
				    gx1 -= sz1 * (step(0.0, gx1) - 0.5); gy1 -= sz1 * (step(0.0, gy1) - 0.5);
				    vec3 g0 = vec3(gx0.x,gy0.x,gz0.x), g1 = vec3(gx0.y,gy0.y,gz0.y),
				        g2 = vec3(gx0.z,gy0.z,gz0.z), g3 = vec3(gx0.w,gy0.w,gz0.w),
				        g4 = vec3(gx1.x,gy1.x,gz1.x), g5 = vec3(gx1.y,gy1.y,gz1.y),
				        g6 = vec3(gx1.z,gy1.z,gz1.z), g7 = vec3(gx1.w,gy1.w,gz1.w);
				    vec4 norm0 = taylorInvSqrt(vec4(dot(g0,g0), dot(g2,g2), dot(g1,g1), dot(g3,g3)));
				    vec4 norm1 = taylorInvSqrt(vec4(dot(g4,g4), dot(g6,g6), dot(g5,g5), dot(g7,g7)));
				    g0 *= norm0.x; g2 *= norm0.y; g1 *= norm0.z; g3 *= norm0.w;
				    g4 *= norm1.x; g6 *= norm1.y; g5 *= norm1.z; g7 *= norm1.w;
				    vec4 nz = mix(vec4(dot(g0, vec3(f0.x, f0.y, f0.z)), dot(g1, vec3(f1.x, f0.y, f0.z)),
				        dot(g2, vec3(f0.x, f1.y, f0.z)), dot(g3, vec3(f1.x, f1.y, f0.z))),
				        vec4(dot(g4, vec3(f0.x, f0.y, f1.z)), dot(g5, vec3(f1.x, f0.y, f1.z)),
				            dot(g6, vec3(f0.x, f1.y, f1.z)), dot(g7, vec3(f1.x, f1.y, f1.z))), f.z);
				    return 2.2 * mix(mix(nz.x,nz.z,f.y), mix(nz.y,nz.w,f.y), f.x);
				}
				float noise(vec2 P) { return noise(vec3(P, 0.0)); }

				float turbulence(vec3 P) {
				    float f = 0., s = 1.;
				    for (int i = 0 ; i < 9 ; i++) {
				        f += abs(noise(s * P)) / s;
				        s *= 2.;
				        P = vec3(.866 * P.x + .5 * P.z, P.y + 100., -.5 * P.x + .866 * P.z);
				    }
				    return f;
				}

				vec3 clouds(float x, float y) {
				    float L = turbulence(vec3(x, y, time * .1));
				    return vec3(noise(vec3(.5, .5, L) * .7));
				}

				float roundOff(vec2 coord, vec2 center, float radius){
					float distance = distance(coord, center);
					float smoothingDist = 1.;

					if(distance < radius && distance > radius - smoothingDist)
						return (radius - distance) / smoothingDist;
					return float(radius > distance);
				}

				float simplify(float value, float multiplier){
					return float(int(value * multiplier)) / multiplier;
				}

				float alphaFor(vec2 coord, float time){
					int x = int(coord.x / cellSize);
					int y = int(coord.y / cellSize);

					vec2 cellStart = vec2(cellSize * float(x), cellSize * float(y));
					vec2 patternStart = cellStart + patternSpacing;
					vec2 patternCenter = patternStart + patternSize/2.;

					if(coord.x < patternStart.x || coord.y < patternStart.y) 
						return 0.;

					vec2 zoomedNoiseCoord = patternStart / noiseZoom;

					/*
					float alpha = 0.;
					for(int i = 0; i < 10; i++)
						alpha += noise(vec3(zoomedNoiseCoord.x + 0.1 * float(i), time, zoomedNoiseCoord.y + 0.1 * float(i)));
					*/

					
					float alpha = noise(vec3(zoomedNoiseCoord.x, time, zoomedNoiseCoord.y)) + 
								noise(vec3(time, zoomedNoiseCoord.x, zoomedNoiseCoord.y)) + 
						  		  noise(vec3(zoomedNoiseCoord.x *20., time, zoomedNoiseCoord.y * 20.));
					


					//alpha = simplify(alpha, 5.);
					//alpha = min(alpha, 1.);
					//alpha *= 0.5;

					//alpha *= roundOff(coord, patternCenter, patternSize/2.);

					return alpha;
				}
				
				void main() {
					vec2 pxLocation = vec2(gl_FragCoord.x, height - gl_FragCoord.y);
					vec2 pos = pxLocation / vec2(width, height);

					gl_FragColor = vec4(
						pos.x, 0, pos.y, 
						alphaFor(pxLocation / dpi, time / 3000.0)
					);
				}
			`);
			gl.compileShader(fragmentShader);
			if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS))
				throw "Could not compile fragment shader:" + gl.getShaderInfoLog(fragmentShader);
			
			// Create program
			const program = gl.createProgram();
			gl.attachShader(program, vertexShader);
			gl.attachShader(program, fragmentShader);
			gl.linkProgram(program);
			if (!gl.getProgramParameter(program, gl.LINK_STATUS)) 
				throw `Could not link the program: ${gl.getProgramInfoLog(program)}`;
			
			gl.detachShader(program, vertexShader);
			gl.detachShader(program, fragmentShader);
			gl.deleteShader(vertexShader);
			gl.deleteShader(fragmentShader);
			gl.useProgram(program);

			// Locate variables
			const a_Position = gl.getAttribLocation(program, 'a_Position');
			gl.enableVertexAttribArray(a_Position);

			this.locationWidth = gl.getUniformLocation(program, "width");
			this.locationHeight = gl.getUniformLocation(program, "height");
			this.locationDpi = gl.getUniformLocation(program, "dpi");
			this.locationTime = gl.getUniformLocation(program, "time");
			this.locationScroll = gl.getUniformLocation(program, "scroll");

			this.startTime = Date.now();

			// Create buffer
			const buffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
	            -1, 1, 1, 1, 1, -1, // Triangle 1
				-1, 1, 1, -1, -1, -1 // Triangle 2 
	        ]), gl.STATIC_DRAW);
	        gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
		}

		this.onDraw = (gl) => {
			gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
	    	gl.clearColor(0.0, 0.0, 0.0, 0.0);
			gl.clear(gl.COLOR_BUFFER_BIT);

			gl.uniform1f(this.locationWidth, gl.drawingBufferWidth);
			gl.uniform1f(this.locationHeight, gl.drawingBufferHeight);
			gl.uniform1f(this.locationDpi, window.devicePixelRatio);
			gl.uniform1f(this.locationTime, Date.now() - this.startTime);
			gl.uniform2f(this.locationScroll, window.scrollX, window.scrollY);

			gl.drawArrays(gl.TRIANGLES, 0, 6);
		}

		// Init
		
	}

	connectedCallback() {
		if(!this.initialized){
			this.initialized = true;

			const canvas = document.createElement("canvas");
			canvas.style.width = "100%";
			canvas.style.height = "100%";
			this.append(canvas);

			this.gl = canvas.getContext("webgl", {
	    		premultipliedAlpha: false
	    	});
	    	this.onInit(this.gl);

	    	this.observer = new ResizeObserver(() => {
				let size = canvas.getBoundingClientRect();
				let dpi = window.devicePixelRatio;
				canvas.width = size.width * dpi;
				canvas.height = size.height * dpi;
				this.repaint();
	  		})

	  		this.scrollListener = () => {
				this.repaint();
			}
		}

		this.timer = setInterval(this.repaint, 100);
		this.observer.observe(this);
		document.addEventListener('scroll', this.scrollListener, { passive: true });
	}

	disconnectedCallback() {
		clearInterval(this.timer);
		this.observer.unobserve(this);
		document.removeEventListener('scroll', this.scrollListener);
	}
}

customElements.define("background-canvas", BackgroundCanvas);