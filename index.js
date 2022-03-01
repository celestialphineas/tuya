// $ live-serve .
(function() {
  const SIZE = 512
  const SPEED = 6
  
  class Tuya {
    /** @param { string | HTMLCanvasElement } canvas */
    constructor(canvas) {
      if (typeof(canvas) === 'string') {
        /** @type { HTMLCanvasElement } */
        this.canvas = document.getElementById(canvas)
      } else {
        this.canvas = canvas
      }
      this.canvas.width = this.canvas.height = SIZE
      /** @type { CanvasRenderingContext2D } */
      this.ctx = this.canvas.getContext('2d')
      this._animationCanvas = document.createElement('canvas')
      this._animationCanvas.width = this._animationCanvas.height = SIZE
      this._animationCtx = this._animationCanvas.getContext('2d')
      this.currentStrokeWidth = this.ctx.lineWidth = this._animationCtx.lineWidth = 8
      this.currentColor = this.ctx.strokeStyle = this._animationCtx.strokeStyle = '#000'
      this.backgroundColor = this.ctx.fillStyle = this._animationCtx.fillStyle = '#fff'
      this.ctx.lineJoin = this._animationCtx.lineJoin = 'round'
      this.ctx.lineCap = this._animationCtx.lineCap = 'round'
      /** @private @type { { path: [number, number][], strokeWidth: number, color: string }[] } */
      this._drawnPaths = []
      this._drawing = false
  
      this.bindMouseEvents()
    }
  
    /** Get the x and y coordinates (on canvas) of a mouse event
     * @param { MouseEvent | TouchEvent } event
     * @returns { [ number, number ] } [ x, y ] */
     xy(event) {
      const clientX = typeof TouchEvent !== 'undefined' &&
        event instanceof TouchEvent ?
          event.touches[0].clientX : event.clientX
      const clientY = typeof TouchEvent !== 'undefined' &&
        event instanceof TouchEvent ?
          event.touches[0].clientY : event.clientY
      const rect = this.canvas.getBoundingClientRect()
      const x = (clientX - rect.left)/rect.width*SIZE
      const y = (clientY - rect.top)/rect.height*SIZE
      return [ x, y ]
    }
  
    bindMouseEvents() {
      let allowMouse = true
      let timer
      /** @param { MouseEvent | TouchEvent } e @param { (any) => any } callback */
      function handleEvent(e, callback) {
        if (typeof TouchEvent !== 'undefined' && e instanceof TouchEvent) {
          allowMouse = false
          clearTimeout(timer)
          timer = setTimeout(() => allowMouse = true, 100)
          callback()
        } else if (e instanceof MouseEvent && allowMouse) {
          callback()
        }
      }
      const isPinch = (e) => typeof TouchEvent !== 'undefined' &&
        e instanceof TouchEvent && e.touches.length > 1 
      const drawBegins = e => { handleEvent(e, () => {
        this.beginDrawing(); this.update() }) }
      const drawContinues = e => { handleEvent(e, () => {
        if (!isPinch(e)) {
          if (e.cancelable) e.preventDefault()
          this.continueDrawing(e)
        }
      }) }
      const drawEnds = e => { handleEvent(e, () => {
        this.endDrawing(); this.update() }) }
      this.canvas.addEventListener('mousedown', drawBegins)
      this.canvas.addEventListener('touchstart', drawBegins)
      this.canvas.addEventListener('mousemove', drawContinues)
      this.canvas.addEventListener('touchmove', drawContinues)
      this.canvas.addEventListener('mouseup', drawEnds)
      this.canvas.addEventListener('mouseleave', drawEnds)
      this.canvas.addEventListener('touchend', drawEnds)
      // Double fingure undo
      this.canvas.addEventListener('touchstart', e => {
        if (e.touches.length === 2) {
          this._readyToUndo = true
        }
      })
      this.canvas.addEventListener('touchmove', e => {
        this._readyToUndo = false
      })
      this.canvas.addEventListener('touchend', e => {
        if (this._readyToUndo) { this.undo(); this._readyToUndo = false }
      })
      this.canvas.addEventListener('touchcancel', e => {
        this._readyToUndo = false
      })
    }
  
    beginDrawing() {
      if (!this._drawing) {
        // Check if the last path is empty
        if (!(this._drawnPaths.length > 0 &&
        this._drawnPaths[this._drawnPaths.length-1].path.length === 0)) {
          this._drawnPaths.push({ path: [], strokeWidth: this.currentStrokeWidth, color: this.currentColor })
        }
        this._drawing = true
      }
    }
  
    continueDrawing(event) {
      if (this._drawing) {
        this._drawnPaths[this._drawnPaths.length-1].path.push(this.xy(event))
        this.render()
      }
    }
  
    endDrawing() {
      if (this._drawing) {
        this._drawing = false
      }
      this.update()
    }
  
    setStyle({
      ctx = this.ctx,
      strokeWidth = this.currentStrokeWidth,
      color = this.currentColor } = {}
    ) {
      ctx.lineWidth = strokeWidth
      ctx.strokeStyle = color
    }
  
    render(ctx = this.ctx) {
      ctx.fillRect(0, 0, SIZE, SIZE)
      this._drawnPaths.forEach(pathObj => {
        const { path, color, strokeWidth } = pathObj
        this.setStyle({ ctx, strokeWidth, color })
        ctx.beginPath()
        path.forEach(([ x, y ]) => ctx.lineTo(x, y))
        ctx.stroke()
      })
    }
  
    undo() {
      const popped = this._drawnPaths.pop()
      if (popped !== undefined && popped.path.length === 0) {
        this._drawnPaths.pop()
      }
      this.update()
    }
  
    clear() {
      this._drawnPaths = []
      this.update()
    }
  
    update() { this.render() }
  
    done(callback = () => {}, { type = 'gif' } = {}) {
      let gif, whammy
      if (type === 'gif') {
        gif = new GIF({
          workers: 4, quality: 10, width: SIZE, height: SIZE,
          workerScript: 'js/gif.worker.js'
        })
      } else {
        whammy = new Whammy.Video()
      }
      const ctx = this._animationCtx
      ctx.fillRect(0, 0, SIZE, SIZE)
      let i = 0
      this._drawnPaths.forEach(pathObj => {
        const { path, strokeWidth, color } = pathObj
        this.setStyle({ ctx, strokeWidth, color })
        ctx.beginPath()
        path.forEach(([ x, y ]) => { 
          ctx.lineTo(x, y)
          ctx.stroke()
          if (i % SPEED === 0) {
            if (type === 'gif') {
              gif.addFrame(this._animationCtx, { delay: 100, copy: true })
            } else {
              whammy.add(this._animationCtx, 100)
            }
          }
          i++
        })
      })

      function download(blob, extension) {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `drawing.${extension}`
        a.click()
      }

      function handleBlob(blob, { type = 'gif' } = {}) {
        if (navigator.share) {
          const mime = { 
            'gif': 'image/gif',
            'webm': 'video/webm'
          }[type]
          const file = new File([blob], 'drawing.' + type, { type: mime })
          
          navigator.share({
            title: '涂鸦',
            files: [ file ]
          }).catch(() => download(blob, type))
        } else {
          download(blob, type)
        }
      }

      // Add the last frame
      if (type === 'gif') {
        gif.addFrame(this._animationCanvas, { delay: 2000, copy: true })
        gif.on('finished', blob => {
          handleBlob(blob, { type: 'gif' })
          callback()
        })
        gif.render()
      } else {
        whammy.add(this._animationCanvas, 2000)
        whammy.compile(false, (blob) => {
          handleBlob(blob, { type: 'webm' })
          callback()
        })
      }
    }
  }
  window.Tuya = Tuya
})();