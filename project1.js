// Last edited by Dietrich Geisler 2025

const VSHADER_SOURCE = `
    attribute vec3 a_Position;
    uniform mat4 u_Model; 
    uniform mat4 u_World; 
    uniform mat4 u_Camera; 
    uniform mat4 u_Projection; 
    attribute vec3 a_Color;
    varying vec3 v_Color;
    void main() {
        gl_Position = u_Projection * u_Camera * u_World * u_Model * vec4(a_Position, 1.0);
        v_Color = a_Color;
    }
`

const FSHADER_SOURCE = `
    varying mediump vec3 v_Color;
    void main() {
        gl_FragColor = vec4(v_Color, 1.0);
    }
`

// references to general information
var g_canvas
var gl
var g_lastFrameMS

// GLSL uniform references
var g_u_model_ref
var g_u_world_ref
var g_u_camera_ref
var g_u_projection_ref

// usual model/world matrices
var g_bottle_modelMatrix
var g_cat1_modelMatrix
var g_cat2_modelMatrix
var g_cat3_modelMatrix
var g_heart_modelMatrix
var g_wing1_modelMatrix
var g_wing2_modelMatrix

var g_worldMatrix
var g_cameraMatrix
var projection_matrix

// camera types
var camera_type=0 // default is orthographic 

// bottle spinning, spins by default
var bottle_spin=true

// ortho camera projection values
var g_near
var g_far
var g_left
var g_right
var g_top
var g_bottom

var g_camera_x // slider translation 
var g_heart_y // heart translation 

// Mesh definitions
var g_bottleMesh
var g_cat1Mesh
var g_cat2Mesh
var g_cat3Mesh
var g_heartMesh
var g_wing1Mesh
var g_wing2Mesh
var g_gridMesh

// We're using triangles, so our vertices each have 3 elements
const TRIANGLE_SIZE = 3

// The size in bytes of a floating point
const FLOAT_SIZE = 4

function main() {
    // perspective projection sliders 
    slider_input = document.getElementById('sliderFOVY')
    slider_input.addEventListener('input', (event) => {
        updateFOVY(event.target.value)
    })

    slider_input = document.getElementById('sliderAspect')
    slider_input.addEventListener('input', (event) => {
        updateAspect(event.target.value)
    })

    // orthographic projection sliders 
    slider_input = document.getElementById('sliderNear')
    slider_input.addEventListener('input', (event) => {
        updateNear(event.target.value)
    })

    slider_input = document.getElementById('sliderFar')
    slider_input.addEventListener('input', (event) => {
        updateFar(event.target.value)
    })

    slider_input = document.getElementById('sliderLeft')
    slider_input.addEventListener('input', (event) => {
        updateLeft(event.target.value)
    })

    slider_input = document.getElementById('sliderRight')
    slider_input.addEventListener('input', (event) => {
        updateRight(event.target.value)
    })

    slider_input = document.getElementById('sliderTop')
    slider_input.addEventListener('input', (event) => {
        updateTop(event.target.value)
    })

    slider_input = document.getElementById('sliderBottom')
    slider_input.addEventListener('input', (event) => {
        updateBottom(event.target.value)
    })

    // camera translation slider
    slider_input = document.getElementById('sliderX')
    slider_input.addEventListener('input', (event) => {
        updateCameraX(event.target.value)
    })

    // heart position slider 
    slider_input = document.getElementById('sliderHeart')
    slider_input.addEventListener('input', (event) => {
        updateHeartY(event.target.value)
    })

    // switching camera 
    button_switch = document.getElementById('cameraSwitch')
    button_switch.addEventListener('click', function() {
        camera_type = 1-camera_type
    })

    // stop spinning bottle  
    bottle_stop = document.getElementById('stopBottle')
    bottle_stop.addEventListener('click', function() {
        bottle_spin = !bottle_spin
    })
    g_canvas = document.getElementById('canvas')

    // Get the rendering context for WebGL
    gl = getWebGLContext(g_canvas, true)
    if (!gl) {
        console.log('Failed to get the rendering context for WebGL')
        return
    }

    // We will call this at the end of most main functions from now on
    loadOBJFiles()
}

/*
 * Helper function to load OBJ files in sequence
 * For much larger files, you may are welcome to make this more parallel
 * I made everything sequential for this class to make the logic easier to follow
 */
async function loadOBJFiles() {
    // open our OBJ file(s) - see citations in comments of OBJ files
    bottle_data = await fetch('./resources/wine2.obj').then(response => response.text()).then((x) => x)
    g_bottleMesh = []
    readObjFile(bottle_data, g_bottleMesh)

    cat_data = await fetch('./resources/cat.obj').then(response => response.text()).then((x) => x)
    g_cat1Mesh = []
    readObjFile(cat_data, g_cat1Mesh)
    g_cat2Mesh = g_cat1Mesh
    g_cat3Mesh = g_cat1Mesh

    heart_data = await fetch('./resources/heart.obj').then(response => response.text()).then((x) => x)
    g_heartMesh = []
    readObjFile(heart_data, g_heartMesh)

    wing_data = await fetch('./resources/wing.obj').then(response => response.text()).then((x) => x)
    g_wing1Mesh = []
    readObjFile(wing_data, g_wing1Mesh)
    g_wing2Mesh = g_wing1Mesh

    // Wait to load our models before starting to render
    startRendering() 
}

function startRendering() {
    // Initialize GPU's vertex and fragment shaders programs
    if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
        console.log('Failed to intialize shaders.')
        return
    }

    // initialize the VBO
    var gridInfo = buildGridAttributes(1, 1, [0.0, 1.0, 0.0])
    g_gridMesh = gridInfo[0]

    var bottleColors = buildColorAttributes(g_bottleMesh.length / 3, isBottle=true, cat=0, isHeart=false)
    var cat1Colors = buildColorAttributes(g_cat1Mesh.length / 3, isBottle=false, cat=1, isHeart=false)
    var cat2Colors = buildColorAttributes(g_cat2Mesh.length / 3, isBottle=false, cat=2, isHeart=false)
    var cat3Colors = buildColorAttributes(g_cat3Mesh.length / 3, isBottle=false, cat=3, isHeart=false)
    var heartColors = buildColorAttributes(g_heartMesh.length / 3, isBottle=false, cat=0, isHeart=true)
    var wingColors = buildColorAttributes((g_wing1Mesh.length)*2 / 3, isBottle=false, cat=1, isHeart=false)
    var data = g_bottleMesh.concat(g_cat1Mesh).concat(g_cat2Mesh).concat(g_cat3Mesh).concat(g_heartMesh).concat(g_wing1Mesh).concat(g_wing2Mesh).concat(gridInfo[0]).concat(bottleColors).concat(cat1Colors).concat(cat2Colors).concat(cat3Colors).concat(heartColors).concat(wingColors).concat(gridInfo[1])
    
    // load all vertex data into VBO ONCE
    if (!initVBO(new Float32Array(data))) {
        return
    }

    // Send our vertex data to the GPU, map vertex data to attributes in VERTEX SHADER
    if (!setupVec3('a_Position', 0, 0)) {
        return
    }
    if (!setupVec3('a_Color', 0, (g_bottleMesh.length + g_cat1Mesh.length + g_cat2Mesh.length + g_cat3Mesh.length + g_heartMesh.length + g_wing1Mesh.length + g_wing2Mesh.length + gridInfo[0].length) * FLOAT_SIZE)) {
        return -1
    }

    // Get references to GLSL uniforms
    g_u_model_ref = gl.getUniformLocation(gl.program, 'u_Model')
    g_u_world_ref = gl.getUniformLocation(gl.program, 'u_World')
    g_u_camera_ref = gl.getUniformLocation(gl.program, 'u_Camera')
    g_u_projection_ref = gl.getUniformLocation(gl.program, 'u_Projection')

    // ** model matrices ** --> transformation matrices that apply changes to the mesh vertices 

    // Setup our model by scaling
    g_bottle_modelMatrix = new Matrix4() //starts as an identity matrix 
    g_bottle_modelMatrix = g_bottle_modelMatrix.setScale(0.012, 0.012, 0.012)
    g_bottle_modelMatrix.translate(0, -20, -110)

    // I want each cat to be its own model matrix
    g_cat1_modelMatrix = new Matrix4()
    g_cat1_modelMatrix = g_cat1_modelMatrix.setScale(0.012, 0.012, 0.012)

    g_cat2_modelMatrix = new Matrix4()
    g_cat2_modelMatrix = g_cat2_modelMatrix.setScale(0.012, 0.012, 0.012)
    
    g_cat3_modelMatrix = new Matrix4()
    g_cat3_modelMatrix = g_cat3_modelMatrix.setScale(0.012, 0.012, 0.012)

    // circle the cats around the spinning bottle 
    g_cat1_modelMatrix.translate(0, -20, -140)  
    g_cat2_modelMatrix.translate(-55, -20, -90) 
    g_cat3_modelMatrix.translate(55, -20, -90)

    g_cat1_modelMatrix.rotate(0, 0, 1, 0)
    g_cat2_modelMatrix.rotate(90, 0, 1, 0) 
    g_cat3_modelMatrix.rotate(-90, 0, 1, 0) 

    // floating heart
    g_heart_modelMatrix = new Matrix4()
    g_heart_modelMatrix = g_heart_modelMatrix.setScale(0.012, 0.012, 0.012)
    g_heart_modelMatrix.translate(0, 30, -90)
    g_heart_modelMatrix.rotate(-90, 1, 0, 0)

    // hearts on wings
    g_wing1_modelMatrix = new Matrix4()
    g_wing1_modelMatrix = g_wing1_modelMatrix.setScale(0.01, 0.01, 0.01)
    g_wing1_modelMatrix.translate(17, 50, -105)
    g_wing1_modelMatrix.rotate(-20, 0, 1, 0)

    g_wing2_modelMatrix = new Matrix4()
    g_wing2_modelMatrix = g_wing2_modelMatrix.setScale(0.01, 0.01, 0.01)
    g_wing2_modelMatrix.translate(-17, 50, -105)
    g_wing2_modelMatrix.rotate(160, 0, 1, 0)

    // Reposition our mesh (in this case as an identity operation)
    g_worldMatrix = new Matrix4()

    // default camera position 
    g_cameraMatrix = new Matrix4()

    // Enable culling and depth tests
    gl.disable(gl.CULL_FACE)
    gl.enable(gl.DEPTH_TEST)

    // Setup for ticks
    g_lastFrameMS = Date.now()

    // initialize the perpective projection parameters 
    updateFOVY(90)
    updateAspect(1)

    //initialize the orthographic projection parameters 
    updateLeft(-1)
    updateRight(1)
    updateBottom(-1)
    updateTop(1)

    updateNear(0.8)
    updateFar(4)

    // camera at origin
    updateCameraX(0)

    // default heart height
    updateHeartY(50)

    tick()
}

// extra constants for cleanliness
var ROTATION_SPEED = .15

// wing flapping animation
var maxAngle = 25;  
var flapDirection = 1;    
var flapAngle = 0; 

// function to apply all the logic for a single frame tick
function tick() {
    // time since the last frame
    var deltaTime

    // calculate deltaTime
    var current_time = Date.now()
    deltaTime = current_time - g_lastFrameMS
    g_lastFrameMS = current_time

    if (bottle_spin) {
        // rotate the arm constantly around the given axis (of the model)
        angle = ROTATION_SPEED * deltaTime
        g_bottle_modelMatrix.concat(new Matrix4().setRotate(angle, 0, 1, 0))
    }

    flapAngle += flapDirection * 0.5;  
    if (Math.abs(flapAngle) >= maxAngle) {
        flapDirection *= -1; // wing flaps other way
    }

    // current heart height 
    g_heart_modelMatrix = new Matrix4()
    g_heart_modelMatrix = g_heart_modelMatrix.setScale(0.012, 0.012, 0.012)
    g_heart_modelMatrix.translate(0, g_heart_y-20, -90)
    g_heart_modelMatrix.rotate(-90, 1, 0, 0)
    
    g_wing1_modelMatrix = new Matrix4();
    g_wing1_modelMatrix.setScale(0.01, 0.01, 0.01);
    g_wing1_modelMatrix.translate(17, g_heart_y, -105);
    g_wing1_modelMatrix.rotate(-20 - flapAngle, 0, 1, 0);  
    
    g_wing2_modelMatrix = new Matrix4();
    g_wing2_modelMatrix.setScale(0.01, 0.01, 0.01);
    g_wing2_modelMatrix.translate(-17, g_heart_y, -105);
    g_wing2_modelMatrix.rotate(-(160 - flapAngle), 0, 1, 0); 
    
    draw()

    requestAnimationFrame(tick, g_canvas)
}

// draw to the screen on the next frame
function draw() {

    if (camera_type == 0) {
        projection_matrix = new Matrix4().setOrtho(g_left, g_right, g_bottom, g_top, g_near, g_far)
    }
    else {
        projection_matrix = new Matrix4().setPerspective(g_fovy, g_aspect, g_near, g_far)
    }
    g_cameraMatrix = new Matrix4().translate(-g_camera_x, 0, 0)

    // Clear the canvas with a black background
    gl.clearColor(0.0, 0.0, 0.0, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    // Update with our global transformation matrices
    // send uniform vars (with the refs) to the VSHADER to transform matrices
    gl.uniformMatrix4fv(g_u_model_ref, false, g_bottle_modelMatrix.elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, g_worldMatrix.elements)
    gl.uniformMatrix4fv(g_u_camera_ref, false, g_cameraMatrix.elements)
    gl.uniformMatrix4fv(g_u_projection_ref, false, projection_matrix.elements)

    // draw bottle 
    gl.drawArrays(gl.TRIANGLES, 0, (g_bottleMesh.length) / 3) 

    // cat drawing party 
    gl.uniformMatrix4fv(g_u_model_ref, false, g_cat1_modelMatrix.elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, g_worldMatrix.elements)
    gl.drawArrays(gl.TRIANGLES, (g_bottleMesh.length) / 3, (g_cat1Mesh.length) / 3)

    gl.uniformMatrix4fv(g_u_model_ref, false, g_cat2_modelMatrix.elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, g_worldMatrix.elements)
    gl.drawArrays(gl.TRIANGLES, (g_bottleMesh.length + g_cat1Mesh.length) / 3, (g_cat2Mesh.length) / 3)

    gl.uniformMatrix4fv(g_u_model_ref, false, g_cat3_modelMatrix.elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, g_worldMatrix.elements)
    gl.drawArrays(gl.TRIANGLES, (g_bottleMesh.length + g_cat1Mesh.length + g_cat2Mesh.length) / 3, (g_cat3Mesh.length) / 3)

    // floating heart 
    gl.uniformMatrix4fv(g_u_model_ref, false, g_heart_modelMatrix.elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, g_worldMatrix.elements)
    gl.drawArrays(gl.TRIANGLES, (g_bottleMesh.length + g_cat1Mesh.length + g_cat2Mesh.length + g_cat3Mesh.length) / 3, (g_heartMesh.length) / 3)

    // wings on heart
    gl.uniformMatrix4fv(g_u_model_ref, false, g_wing1_modelMatrix.elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, g_worldMatrix.elements)
    gl.drawArrays(gl.TRIANGLES, (g_bottleMesh.length + g_cat1Mesh.length + g_cat2Mesh.length + g_cat3Mesh.length + g_heartMesh.length) / 3, g_wing1Mesh.length / 3)

    gl.uniformMatrix4fv(g_u_model_ref, false, g_wing2_modelMatrix.elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, g_worldMatrix.elements)
    gl.drawArrays(gl.TRIANGLES, (g_bottleMesh.length + g_cat1Mesh.length + g_cat2Mesh.length + g_cat3Mesh.length + g_heartMesh.length + g_wing1Mesh.length) / 3, g_wing2Mesh.length / 3)

    // the grid has a constant identity matrix for model and world
    // world includes our Y offset
    gl.uniformMatrix4fv(g_u_model_ref, false, new Matrix4().elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, new Matrix4().translate(0, GRID_Y_OFFSET, 0).elements)

    // draw the grid
    gl.drawArrays(gl.LINES, (g_bottleMesh.length + g_cat1Mesh.length + g_cat2Mesh.length + g_cat3Mesh.length + g_heartMesh.length + g_wing1Mesh.length + g_wing2Mesh.length) / 3, g_gridMesh.length / 3)
}

// Helper to construct colors
// makes every triangle a slightly different shade of blue
function buildColorAttributes(vertex_count, isBottle=false, cat=0, isHeart=false) {
    var colors = []
    for (var i = 0; i < vertex_count / 3; i++) {
        // three vertices per triangle
        for (var vert = 0; vert < 3; vert++) {
            var shade = (i * 3) / vertex_count
            if (isBottle){colors.push(1.0, 0.0, 0.0)} //red bottle 
            else if (cat == 1) {colors.push(shade, shade, shade)}
            else if (cat == 2) {
                let rand = Math.random();
                if (rand < 0.33) {
                    colors.push(1.0, 1.0, 1.0); // White
                } else if (rand < 0.66) {
                    colors.push(0.1, 0.1, 0.1); // Black
                } else {
                    colors.push(1.0, 0.5, 0.2); // Orange
                }
            }
            else if (cat == 3) {colors.push(0.8 * shade + 0.3, 0.6 * shade + 0.3, 0.4 * shade + 0.2)}
            else if (isHeart) {colors.push(0.7, 0.1 * (1 - shade) + 0.05, 0.3 * shade + 0.2)}
        }
    }
    return colors
}


function updateNear(amount) {
    label = document.getElementById('near')
    label.textContent = `Near: ${Number(amount).toFixed(2)}`
    g_near = Number(amount)
}

function updateFar(amount) {
    label = document.getElementById('far')
    label.textContent = `Far: ${Number(amount).toFixed(2)}`
    g_far = Number(amount)
}

// adjust perspective camera
function updateFOVY(amount) {
    label = document.getElementById('fovy')
    label.textContent = `FOVY: ${Number(amount).toFixed(2)}`
    g_fovy = Number(amount)
}

function updateAspect(amount) {
    label = document.getElementById('aspect')
    label.textContent = `Aspect: ${Number(amount).toFixed(2)}`
    g_aspect = Number(amount)
}

// adjust orthographic camera
function updateLeft(amount) {
    label = document.getElementById('left')
    label.textContent = `Left: ${Number(amount).toFixed(2)}`
    g_left = Number(amount)
}

function updateRight(amount) {
    label = document.getElementById('right')
    label.textContent = `Right: ${Number(amount).toFixed(2)}`
    g_right = Number(amount)
}

function updateBottom(amount) {
    label = document.getElementById('bottom')
    label.textContent = `Bottom: ${Number(amount).toFixed(2)}`
    g_bottom = Number(amount)
}

function updateTop(amount) {
    label = document.getElementById('top')
    label.textContent = `Top: ${Number(amount).toFixed(2)}`
    g_top = Number(amount)
}

// translate camera 
function updateCameraX(amount) {
    label = document.getElementById('cameraX')
    label.textContent = `Camera X: ${Number(amount).toFixed(2)}`
    g_camera_x = Number(amount)
}

//translate heart
function updateHeartY(amount) {
    label = document.getElementById('heartY')
    label.textContent = `Heart height: ${Number(amount).toFixed(2)}`
    g_heart_y = Number(amount)
}

// How far in the X and Z directions the grid should extend
// Recall that the camera "rests" on the X/Z plane, since Z is "out" from the camera
const GRID_X_RANGE = 1000
const GRID_Z_RANGE = 1000

// The default y-offset of the grid for rendering
const GRID_Y_OFFSET = -0.5

/*
 * Helper to build a grid mesh and colors
 * Returns these results as a pair of arrays
 * Each vertex in the mesh is constructed with an associated grid_color
 */
function buildGridAttributes(grid_row_spacing, grid_column_spacing, grid_color) {
    var mesh = []
    var colors = []

    // Construct the rows
    for (var x = -GRID_X_RANGE; x < GRID_X_RANGE; x += grid_row_spacing) {
        // two vertices for each line
        // one at -Z and one at +Z
        mesh.push(x, 0, -GRID_Z_RANGE)
        mesh.push(x, 0, GRID_Z_RANGE)
    }

    // Construct the columns extending "outward" from the camera
    for (var z = -GRID_Z_RANGE; z < GRID_Z_RANGE; z += grid_column_spacing) {
        // two vertices for each line
        // one at -Z and one at +Z
        mesh.push(-GRID_X_RANGE, 0, z)
        mesh.push(GRID_X_RANGE, 0, z)
    }

    // We need one color per vertex
    // since we have 3 components for each vertex, this is length/3
    for (var i = 0; i < mesh.length / 3; i++) {
        colors.push(grid_color[0], grid_color[1], grid_color[2])
    }

    return [mesh, colors]
}

/*
 * Initialize the VBO with the provided data
 * Assumes we are going to have "static" (unchanging) data
 */
function initVBO(data) {
    // get the VBO handle
    var VBOloc = gl.createBuffer()
    if (!VBOloc) {
        return false
    }

    // Bind the VBO to the GPU array and copy `data` into that VBO
    gl.bindBuffer(gl.ARRAY_BUFFER, VBOloc)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)

    return true
}

/*
 * Helper function to load the given vec3 data chunk onto the VBO
 * Requires that the VBO already be setup and assigned to the GPU
 */
function setupVec3(name, stride, offset) {
    // Get the attribute by name
    var attributeID = gl.getAttribLocation(gl.program, `${name}`)
    if (attributeID < 0) {
        console.log(`Failed to get the storage location of ${name}`)
        return false
    }

    // Set how the GPU fills the a_Position variable with data from the GPU 
    gl.vertexAttribPointer(attributeID, 3, gl.FLOAT, false, stride, offset)
    gl.enableVertexAttribArray(attributeID)

    return true
}

// CITATIONS
// 1. project1starter.HTML, project1starter.js - provided starter HTML and JS code 
// 2. free3d.com - OBJ file download
// 3. cgtrader.com - OBJ file download 
// 4. ChatGPT - randomize calico cat's fur, find shades for cats and heart