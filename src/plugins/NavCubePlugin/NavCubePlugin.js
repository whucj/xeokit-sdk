import {Plugin} from "././../../../src/viewer/Plugin.js";
import {math} from "../../../src/viewer/scene/math/math.js";
import {Scene} from "../../../src/viewer/scene/scene/Scene.js";
import {DirLight} from "./../../../src/viewer/scene/lights/DirLight.js";
import {Mesh} from "./../../../src/viewer/scene/mesh/Mesh.js";
import {ReadableGeometry} from "../../../src/viewer/scene/geometry/ReadableGeometry.js";
import {PhongMaterial} from "../../../src/viewer/scene/materials/PhongMaterial.js";
import {Texture} from "../../../src/viewer/scene/materials/Texture.js";
import {buildCylinderGeometry} from "../../../src/viewer/scene/geometry/builders/buildCylinderGeometry.js";
import {CubeTextureCanvas} from "./CubeTextureCanvas.js";

/**
 * {@link Viewer} plugin that provides a navigation control that lets us look at the {@link Scene} from along a chosen axis or diagonal.
 *
 * The NavCube is an interactive 3D cube gizmo that appears in a corner of the Viewer's {@link Canvas}.
 *
 * Rotating the cube causes the Viewer's {@link Camera} to orbit its current point-of-interest. Orbiting the Camera
 * causes the cube to rotate in synch.
 *
 * The faces of the cube are aligned with the Viewer's {@link Scene}'s World-space coordinate axis. Clicking on a face moves
 * the Camera to look at the entire Scene along the corresponding axis. Clicking on an edge or a corner looks at
 * the entire Scene along a diagonal.
 *
 * The NavCube can be configured to either jump or fly the Camera to each new position. We can configure how tightly the
 * NavCube fits the Scene to view, and when flying, we can configure how fast it flies. See below for a usage example.
 *
 * ## Usage
 *
 * In the example below, we'll create a Viewer and add a NavCubePlugin, which will create a NavCube gizmo in the corner of
 * Viewer's Canvas. Then we'll use the {@link GLTFLoaderPlugin} to load a model into the Viewer's Scene. We can then
 * use the NavCube to look at the model along each axis or diagonal.
 *
 * * [[Run this example](https://xeokit.github.io/xeokit-sdk/examples/#gizmos_NavCubePlugin)]
 *
 * ````JavaScript````
 * import {Viewer} from "../src/viewer/Viewer.js";
 * import {GLTFLoaderPlugin} from "../src/plugins/GLTFLoaderPlugin/GLTFLoaderPlugin.js";
 * import {NavCubePlugin} from "../src/plugins/NavCubePlugin/NavCubePlugin.js";
 *
 * const viewer = new Viewer({
 *     canvasId: "myCanvas"
 * });
 *
 * viewer.camera.eye = [-3.93, 2.85, 27.01];
 * viewer.camera.look = [4.40, 3.72, 8.89];
 * viewer.camera.up = [-0.01, 0.99, 0.03];
 *
 * const navCube = new NavCubePlugin(viewer, {
 *
 *     visible: true,           // Initially visible (default)
 *
 *     size: 250,               // NavCube size in pixels (default is 200)
 *     alignment: "topRight",   // Align NavCube to top-right of Viewer canvas
 *     topMargin: 170,          // 170 pixels margin from top of Viewer canvas
 *
 *     cameraFly: true,       // Fly camera to each selected axis/diagonal
 *     cameraFitFOV: 45,        // How much field-of-view the scene takes once camera has fitted it to view
 *     cameraFlyDuration: 0.5 // How long (in seconds) camera takes to fly to each new axis/diagonal
 * });
 *
 * const gltfLoader = new GLTFLoaderPlugin(viewer);
 *
 * const model = gltfLoader.load({
 *     id: "myModel",
 *     src: "./models/gltf/duplex/scene.gltf",
 *     metaModelSrc: "./metaModels/duplex/metaModel.json", // Sets visual states of object in model
 *     edges: true
 * });
 * ````
 */
class NavCubePlugin extends Plugin {

    /**
     * @constructor
     * @param {Viewer} viewer The Viewer.
     * @param {Object} cfg NavCubePlugin configuration.
     * @param {String} [cfg.id="NavCube"] Optional ID for this plugin, so that we can find it within {@link Viewer#plugins}.
     * @param {Boolean} [cfg.visible=true] Initial visibility.
     * @param {Number} [cfg.size=200] Size of the NavCube area, in pixels.
     * @param {String} [cfg.alignment="bottomRight"] The alignment of the NavCube within the bounds of the {@link Viewer}'s {@link Canvas}. Accepted values are "bottomRight", "bottomLeft", "topLeft" and "topRight".
     * @param {Number} [cfg.leftMargin=10] The margin between the NavCube and the left edge of the {@link Viewer}'s {@link Canvas}, in pixels.
     * @param {Number} [cfg.rightMargin=10] The margin between the NavCube and the right edge of the {@link Viewer}'s {@link Canvas}, in pixels.
     * @param {Number} [cfg.topMargin=10] The margin between the NavCube and the top edge of the {@link Viewer}'s {@link Canvas}, in pixels.
     * @param {Number} [cfg.bottomMargin=10] The margin between the NavCube and the bottom edge of the {@link Viewer}'s {@link Canvas}, in pixels.
     * @param {String} [cfg.cameraFly=true] Whether the {@link Camera} flies or jumps to each selected axis or diagonal.
     * @param {String} [cfg.cameraFitFOV=45] How much of the field-of-view, in degrees, that the 3D scene should fill the {@link Canvas} when the {@link Camera} moves to an axis or diagonal.
     * @param {String} [cfg.cameraFlyDuration=0.5] When flying the {@link Camera} to each new axis or diagonal, how long, in seconds, that the Camera takes to get there.
     */
    constructor(viewer, cfg = {}) {

        super("NavCube", viewer, cfg);

        viewer.navCube = this;

        var visible = true;

        var size = cfg.size || 250;
        this._navCubeCanvas = document.createElement('canvas');
        this._navCubeCanvas.id = "cubeCanvas" + viewer.scene.canvas.canvas.id;

        var style = this._navCubeCanvas.style;
        style.height = size + "px";
        style.width = size + "px";
        style.padding = "0";
        style.margin = "0";
        style.top = "0px";
        style.left = "0px";
        style.position = "absolute";
        style["z-index"] = "2000000";
        style.visibility = visible ? "visible" : "hidden";

        document.body.appendChild(this._navCubeCanvas);

        var navCubeScene = new Scene({
            canvasId: this._navCubeCanvas.id,
            transparent: true
        });

        navCubeScene.clearLights();

        new DirLight(navCubeScene, {dir: [0.4, -0.4, 0.8], color: [0.8, 1.0, 1.0], intensity: 1.0, space: "view"});
        new DirLight(navCubeScene, {dir: [-0.8, -0.3, -0.4], color: [0.8, 0.8, 0.8], intensity: 1.0, space: "view"});
        new DirLight(navCubeScene, {dir: [0.8, -0.6, -0.8], color: [1.0, 1.0, 1.0], intensity: 1.0, space: "view"});

        this._navCubeCamera = navCubeScene.camera;
        this._navCubeCamera.ortho.scale = 7.0;
        this._navCubeCamera.ortho.near = 0.1;
        this._navCubeCamera.ortho.far = 2000;

        this._zUp = false;

        var self = this;

        this._synchCamera = (function () {
            var matrix = math.rotationMat4c(-90 * math.DEGTORAD, 1, 0, 0);
            var eyeLookVec = math.vec3();
            var eyeLookVecCube = math.vec3();
            var upCube = math.vec3();
            return function () {
                var eye = viewer.camera.eye;
                var look = viewer.camera.look;
                var up = viewer.camera.up;
                eyeLookVec = math.mulVec3Scalar(math.normalizeVec3(math.subVec3(eye, look, eyeLookVec)), 5);
                if (self._zUp) { // +Z up
                    math.transformVec3(matrix, eyeLookVec, eyeLookVecCube);
                    math.transformVec3(matrix, up, upCube);
                    self._navCubeCamera.look = [0, 0, 0];
                    self._navCubeCamera.eye = math.transformVec3(matrix, eyeLookVec, eyeLookVecCube);
                    self._navCubeCamera.up = math.transformPoint3(matrix, up, upCube);
                } else { // +Y up
                    self._navCubeCamera.look = [0, 0, 0];
                    self._navCubeCamera.eye = eyeLookVec;
                    self._navCubeCamera.up = up;
                }
            };
        }());

        this._onCameraMatrix = viewer.camera.on("matrix", this._synchCamera);
        this._onCameraWorldAxis = viewer.camera.on("worldAxis", this._synchCamera);
        this._onCameraFOV = viewer.camera.perspective.on("fov", (fov) => {
            this._navCubeCamera.perspective.fov = fov;
        });
        this._onCameraProjection = viewer.camera.on("projection", (projection) => {
            this._navCubeCamera.projection = projection;
        });

        viewer.camera.on("worldAxis", (worldAxis) => {
            /*
        case "zUp":
            this._zUp = true;
            this._cubeTextureCanvas.setZUp();
            this._repaint();
            this._synchCamera();
            break;
        case "yUp":
            this._zUp = false;
            this._cubeTextureCanvas.setYUp();
            this._repaint();
            this._synchCamera();
            break;
            */
        });

        this._cubeTextureCanvas = new CubeTextureCanvas(viewer);

        this._cubeSampler = new Texture(navCubeScene, {
            image: this._cubeTextureCanvas.getImage(),
            flipY: true,
            wrapS: "clampToEdge",
            wrapT: "clampToEdge"
        });

        this._cubeMesh = new Mesh(navCubeScene, {
            geometry: new ReadableGeometry(navCubeScene, {
                primitive: "triangles",
                normals: [
                    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
                    0, 1, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, -1,
                    0, 0, -1, 0, 0, -1, 0, 0, -1
                ],
                positions: [
                    1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, -1,
                    1, -1, -1, 1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1,
                    1, 1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1
                ],
                uv: [
                    0.5, 0.6666, 0.25, 0.6666, 0.25, 0.3333, 0.5, 0.3333, 0.5, 0.6666, 0.5, 0.3333, 0.75, 0.3333, 0.75, 0.6666,
                    0.5, 0.6666, 0.5, 1, 0.25, 1, 0.25, 0.6666, 0.25, 0.6666, 0.0, 0.6666, 0.0, 0.3333, 0.25, 0.3333,
                    0.25, 0, 0.50, 0, 0.50, 0.3333, 0.25, 0.3333, 0.75, 0.3333, 1.0, 0.3333, 1.0, 0.6666, 0.75, 0.6666
                ],
                indices: [
                    0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16,
                    18, 19, 20, 21, 22, 20, 22, 23
                ]
            }),
            material: new PhongMaterial(navCubeScene, {
                diffuse: [0.4, 0.4, 0.4],
                specular: [0.4, 0.4, 0.4],
                emissive: [.6, .6, .6],
                diffuseMap: this._cubeSampler,
                emissiveMap: this._cubeSampler
            }),
            visible: !!visible,
            edges: true
        });

        this._shadow = new Mesh(navCubeScene, {
            geometry: new ReadableGeometry(navCubeScene, buildCylinderGeometry({
                center: [0, 0, 0],
                radiusTop: 0.001,
                radiusBottom: 1.4,
                height: 0.01,
                radialSegments: 20,
                heightSegments: 1,
                openEnded: true
            })),
            material: new PhongMaterial(navCubeScene, {
                diffuse: [0.0, 0.0, 0.0], specular: [0, 0, 0], emissive: [0.0, 0.0, 0.0], alpha: 0.5
            }),
            position: [0, -1.5, 0],
            visible: !!visible,
            pickable: false,
            backfaces: false
        });

        var lastAreaId = -1;

        function actionMove(posX, posY) {
            var yawInc = (posX - lastX) * -sensitivity;
            var pitchInc = (posY - lastY) * -sensitivity;
            yaw -= yawInc;
            pitch -= pitchInc;
            if (minPitch !== undefined && pitch < minPitch) {
                pitch = minPitch;
            }
            if (maxPitch !== undefined && pitch > maxPitch) {
                pitch = maxPitch;
            }
            viewer.camera.orbitYaw(yawInc);
            viewer.camera.orbitPitch(-pitchInc);
            lastX = posX;
            lastY = posY;
        }

        function getCoordsWithinElement(event) {
            var coords = [0, 0];
            if (!event) {
                event = window.event;
                coords[0] = event.x;
                coords[1] = event.y;
            } else {
                var element = event.target;
                var totalOffsetLeft = 0;
                var totalOffsetTop = 0;
                while (element.offsetParent) {
                    totalOffsetLeft += element.offsetLeft;
                    totalOffsetTop += element.offsetTop;
                    element = element.offsetParent;
                }
                coords[0] = event.pageX - totalOffsetLeft;
                coords[1] = event.pageY - totalOffsetTop;
            }
            return coords;
        }

        {
            var downX = null;
            var downY = null;
            var down = false;
            var over = false;

            var yaw = 0;
            var pitch = 0;
            var minPitch = null;
            var maxPitch = null;
            var sensitivity = 0.5;

            var lastX;
            var lastY;
            var dragging = false;

            self._navCubeCanvas.addEventListener("mouseenter", self._onMouseEnter = function (e) {
                over = true;
            });


            self._navCubeCanvas.addEventListener("mouseleave", self._onMouseLeave = function (e) {
                over = false;
            });

            self._navCubeCanvas.addEventListener("mousedown", self._onMouseDown = function (e) {
                downX = e.x;
                downY = e.y;
                lastX = e.clientX;
                lastY = e.clientY;
                var canvasPos = getCoordsWithinElement(e);
                var hit = navCubeScene.pick({
                    canvasPos: canvasPos
                });
                if (hit) {
                    down = true;

                } else {
                    down = false;
                }
            });

            document.addEventListener("mouseup", self._onMouseUp = function (e) {
                if (e.which !== 1) {// Left button
                    return;
                }
                down = false;
                if (downX === null) {
                    return;
                }
                var canvasPos = getCoordsWithinElement(e);
                var hit = navCubeScene.pick({
                    canvasPos: canvasPos,
                    pickSurface: true
                });
                if (hit) {
                    if (hit.uv) {
                        var areaId = self._cubeTextureCanvas.getArea(hit.uv);
                        if (areaId >= 0) {
                            document.body.style.cursor = "pointer";
                            if (lastAreaId >= 0) {
                                self._cubeTextureCanvas.setAreaHighlighted(lastAreaId, false);
                                self._repaint();
                                lastAreaId = -1;
                            }
                            if (areaId >= 0) {
                                self._cubeTextureCanvas.setAreaHighlighted(areaId, true);
                                lastAreaId = areaId;
                                self._repaint();
                                if (e.x < (downX - 3) || e.x > (downX + 3) || e.y < (downY - 3) || e.y > (downY + 3)) {
                                    return;
                                }
                                var dir = self._cubeTextureCanvas.getAreaDir(areaId);
                                if (dir) {
                                    var up = self._cubeTextureCanvas.getAreaUp(areaId);
                                    flyTo(dir, up, function () {
                                        if (lastAreaId >= 0) {
                                            self._cubeTextureCanvas.setAreaHighlighted(lastAreaId, false);
                                            self._repaint();
                                            lastAreaId = -1;
                                        }
                                        var hit = navCubeScene.pick({
                                            canvasPos: canvasPos,
                                            pickSurface: true
                                        });
                                        if (hit) {
                                            if (hit.uv) {
                                                var areaId = self._cubeTextureCanvas.getArea(hit.uv);
                                                if (areaId !== undefined) {
                                                    document.body.style.cursor = "pointer";
                                                    if (lastAreaId >= 0) {
                                                        self._cubeTextureCanvas.setAreaHighlighted(lastAreaId, false);
                                                        self._repaint();
                                                        lastAreaId = -1;
                                                    }
                                                    if (areaId >= 0) {
                                                        self._cubeTextureCanvas.setAreaHighlighted(areaId, true);
                                                        lastAreaId = areaId;
                                                        self._repaint();
                                                    }
                                                }
                                            }
                                        }
                                    });
                                }
                            }
                        }
                    }
                }
            });

            document.addEventListener("mousemove", self._onMouseMove = function (e) {
                if (lastAreaId >= 0) {
                    self._cubeTextureCanvas.setAreaHighlighted(lastAreaId, false);
                    self._repaint();
                    lastAreaId = -1;
                }
                if (e.buttons === 1 && !down) {
                    return;
                }
                if (down) {
                    var posX = e.clientX;
                    var posY = e.clientY;
                    document.body.style.cursor = "move";
                    actionMove(posX, posY);
                    return;
                }
                if (!over) {
                    return;
                }
                var canvasPos = getCoordsWithinElement(e);
                var hit = navCubeScene.pick({
                    canvasPos: canvasPos,
                    pickSurface: true
                });
                if (hit) {
                    if (hit.uv) {
                        document.body.style.cursor = "pointer";
                        var areaId = self._cubeTextureCanvas.getArea(hit.uv);
                        if (areaId === lastAreaId) {
                            return;
                        }
                        if (lastAreaId >= 0) {
                            self._cubeTextureCanvas.setAreaHighlighted(lastAreaId, false);
                        }
                        if (areaId >= 0) {
                            self._cubeTextureCanvas.setAreaHighlighted(areaId, true);
                            self._repaint();
                            lastAreaId = areaId;
                        }
                    }
                } else {
                    document.body.style.cursor = "default";
                    if (lastAreaId >= 0) {
                        self._cubeTextureCanvas.setAreaHighlighted(lastAreaId, false);
                        self._repaint();
                        lastAreaId = -1;
                    }
                }
            });

            var flyTo = (function () {
                var center = math.vec3();
                return function (dir, up, ok) {
                    var aabb = viewer.scene.aabb;
                    var diag = math.getAABB3Diag(aabb);
                    math.getAABB3Center(aabb, center);
                    var dist = Math.abs(diag / Math.tan(55.0 / 2));
                    if (self._cameraFly) {
                        viewer.cameraFlight.flyTo({
                            look: center,
                            eye: [center[0] - (dist * dir[0]), center[1] - (dist * dir[1]), center[2] - (dist * dir[2])],
                            up: up || [0, 1, 0],
                            orthoScale: diag * 1.3,
                            fitFOV: self._cameraFitFOV,
                            duration: self._cameraFlyDuration
                        }, ok);
                    } else {
                        viewer.cameraFlight.jumpTo({
                            look: center,
                            eye: [center[0] - (dist * dir[0]), center[1] - (dist * dir[1]), center[2] - (dist * dir[2])],
                            up: up || [0, 1, 0],
                            orthoScale: diag * 1.3,
                            fitFOV: self._cameraFitFOV
                        }, ok);
                    }
                };
            })();
        }

        this._onCanvasBoundary = viewer.scene.canvas.on("boundary", () => {
            this._needUpdateLayout = true;
        });

        this._onSceneTick = viewer.scene.on("tick", () => {
            if (this._needUpdateLayout) {
                this._updateLayout();
            }
        });

        this.setVisible(cfg.visible);
        this.setSize(cfg.size);
        this.setAlignment(cfg.alignment);
        this.setLeftMargin(cfg.leftMargin);
        this.setRightMargin(cfg.rightMargin);
        this.setTopMargin(cfg.topMargin);
        this.setBottomMargin(cfg.bottomMargin);
        this.setCameraFitFOV(cfg.cameraFitFOV);
        this.setCameraFly(cfg.cameraFly);
        this.setCameraFlyDuration(cfg.cameraFlyDuration);
    }

    send(name, value) {
        switch (name) {
            case "language":
                this._cubeTextureCanvas.clear();
                this._repaint(); // CubeTextureCanvas gets language from Viewer
                break;
        }
    }

    _repaint() {
        const image = this._cubeTextureCanvas.getImage();
        this._cubeMesh.material.diffuseMap.image = image;
        this._cubeMesh.material.emissiveMap.image = image;
    }

    _updateLayout() {
        const boundary = this.viewer.scene.canvas.boundary;
        const size = this._size;
        const style = this._navCubeCanvas.style;
        style.width = size + "px";
        style.height = size + "px";
        switch (this._alignment) {
            case "bottomRight":
                style.top = (boundary[1] + boundary[3] - size - this._bottomMargin) + "px";
                style.left = (boundary[0] + boundary[2] - size - this._rightMargin) + "px";
                break;
            case "bottomLeft":
                style.top = (boundary[1] + boundary[3] - size - this._bottomMargin) + "px";
                style.left = this._leftMargin + "px";
                break;
            case "topLeft":
                style.top = this._topMargin + "px";
                style.left = this._leftMargin + "px";
                break;
            case "topRight":
                style.top = this._topMargin + "px";
                style.left = (boundary[0] + boundary[2] - size - this._rightMargin) + "px";
                break;
        }
        this._needUpdateLayout = false;
    }


    /**
     * Sets if the NavCube is visible.
     *
     * @param {Boolean} visible Whether or not the NavCube is visible.
     */
    setVisible(visible = true) {
        this._cubeMesh.visible = visible;
        this._shadow.visible = visible;
        this._navCubeCanvas.style.visibility = visible ? "visible" : "hidden";
        this._needUpdateLayout = true;
    }

    /**
     * Gets if the NavCube is visible.
     *
     * @return {Boolean} True when the NavCube is visible.
     */
    getVisible() {
        return this._cubeMesh.visible;
    }

    /**
     * Sets the canvas size of the NavCube.
     *
     * Since the canvas is square, the size is given for a single dimension. Default value is ````200````.
     *
     * @param {number} size The canvas size, in pixels.
     */
    setSize(size = 200) {
        this._size = size;
        this._navCubeCanvas.width = size;
        this._navCubeCanvas.height = size;
        this._needUpdateLayout = true;
    }

    /**
     * Gets the canvas size of the NavCube.
     *
     * Since the canvas is square, the size is given for a single dimension.
     *
     * @returns {number} The canvas size.
     */
    getSize() {
        return this._size;
    };

    /**
     * Sets the alignment of the NavCube within the bounds of the {@link Viewer}'s {@link Canvas}.
     *
     * Default value is "bottomRight".
     *
     * @param {String} alignment The alignment - "bottomRight" (default) | "bottomLeft" | "topLeft" | "topRight"
     */
    setAlignment(alignment = "bottomRight") {
        if (alignment !== "bottomRight" && alignment !== "bottomLeft" && alignment !== "topLeft" && alignment !== "topRight") {
            this.error("Illegal value for alignment - defaulting to `bottomRight'");
            alignment = "bottomRight";
        }
        this._alignment = alignment;
        this._needUpdateLayout = true;
    }

    /**
     * Gets the alignment of the NavCube within the bounds of the {@link Viewer}'s {@link Canvas}.
     *
     * Default value is "bottomRight".
     *
     * @returns {String} The alignment - "bottomRight" (default) | "bottomLeft" | "topLeft" | "topRight"
     */
    getAlignment() {
        return this._alignment;
    }

    /**
     * Sets the margin between the NavCube and the left edge of the {@link Viewer}'s {@link Canvas}.
     *
     * This applies when the NavCube's alignment is "topLeft" or "bottomLeft". Default value is ````10````.
     *
     * @param {Number} leftMargin The left margin value, in pixels.
     */
    setLeftMargin(leftMargin = 10) {
        this._leftMargin = (leftMargin !== null && leftMargin !== undefined) ? leftMargin : 10;
        this._needUpdateLayout = true;
    }

    /**
     * Gets the margin between the NavCube and the left edge of the {@link Viewer}'s {@link Canvas}.
     *
     * This applies when the NavCube's alignment is "topLeft" or "bottomLeft". Default value is ````10````.
     *
     * @return {Number} leftMargin The left margin value, in pixels.
     */
    getLeftMargin() {
        return this._leftMargin;
    }

    /**
     * Sets the margin between the NavCube and the right edge of the {@link Viewer}'s {@link Canvas}.
     *
     * This applies when the NavCube's alignment is "topRight" or "bottomRight". Default value is ````10````.
     *
     * @param {Number} rightMargin The right margin value, in pixels.
     */
    setRightMargin(rightMargin = 10) {
        this._rightMargin = (rightMargin !== null && rightMargin !== undefined) ? rightMargin : 10;
        this._needUpdateLayout = true;
    }

    /**
     * Gets the margin between the NavCube and the right edge of the {@link Viewer}'s {@link Canvas}.
     *
     * This applies when the NavCube's alignment is "topRight" or "bottomRight". Default value is ````10````.
     *
     * @return {Number} rightMargin The right margin value, in pixels.
     */
    getRightMargin() {
        return this._rightMargin;
    }

    /**
     * Sets the margin between the NavCube and the top edge of the {@link Viewer}'s {@link Canvas}.
     *
     * This applies when the NavCube's alignment is "topRight" or "topLeft". Default value is ````10````.
     *
     * @param {Number} topMargin The top margin value, in pixels.
     */
    setTopMargin(topMargin = 10) {
        this._topMargin = (topMargin !== null && topMargin !== undefined) ? topMargin : 10;
        this._needUpdateLayout = true;
    }

    /**
     * Gets the margin between the NavCube and the top edge of the {@link Viewer}'s {@link Canvas}.
     *
     * This applies when the NavCube's alignment is "topRight" or "topLeft". Default value is ````10````.
     *
     * @return {Number} topMargin The top margin value, in pixels.
     */
    getTopMargin() {
        return this._topMargin;
    }

    /**
     * Sets the margin between the NavCube and the bottom edge of the {@link Viewer}'s {@link Canvas}.
     *
     * This applies when the NavCube's alignment is "bottomRight" or "bottomLeft". Default value is ````10````.
     *
     * @param {Number} bottomMargin The bottom margin value, in pixels.
     */
    setBottomMargin(bottomMargin = 10) {
        this._bottomMargin = (bottomMargin !== null && bottomMargin !== undefined) ? bottomMargin : 10;
        this._needUpdateLayout = true;
    }

    /**
     * Gets the margin between the NavCube and the bottom edge of the {@link Viewer}'s {@link Canvas}.
     *
     * This applies when the NavCube's alignment is "bottomRight" or "bottomLeft". Default value is ````10````.
     *
     * @return {Number} bottomMargin The bottom margin value, in pixels.
     */
    getBottomMargin() {
        return this._bottomMargin;
    }

    /**
     * Sets whether the {@link Camera} flies or jumps to each selected axis or diagonal.
     *
     * Default is ````true````, to fly.
     *
     * @param {Boolean} cameraFly Set ````true```` to fly, else ````false```` to jump.
     */
    setCameraFly(cameraFly = true) {
        this._cameraFly = cameraFly;
    }

    /**
     * Gets whether the {@link Camera} flies or jumps to each selected axis or diagonal.
     *
     * Default is ````true````, to fly.
     *
     * @returns {Boolean} Returns ````true```` to fly, else ````false```` to jump.
     */
    getCameraFly() {
        return this._cameraFly;
    }

    /**
     * Sets how much of the field-of-view, in degrees, that the {@link Scene} should
     * fill the canvas when flying or jumping the {@link Camera} to each selected axis or diagonal.
     *
     * Default value is ````45````.
     *
     * @param {Number} cameraFitFOV New FOV value.
     */
    setCameraFitFOV(cameraFitFOV = 45) {
        this._cameraFitFOV = cameraFitFOV;
    }

    /**
     * Gets how much of the field-of-view, in degrees, that the {@link Scene} should
     * fill the canvas when flying or jumping the {@link Camera} to each selected axis or diagonal.
     *
     * Default value is ````45````.
     *
     * @returns {Number} Current FOV value.
     */
    getCameraFitFOV() {
        return this._cameraFitFOV;
    }

    /**
     * When flying the {@link Camera} to each new axis or diagonal, sets how long, in seconds, that the Camera takes to get there.
     *
     * Default is ````0.5````.
     *
     * @param {Boolean} cameraFlyDuration Camera flight duration in seconds.
     */
    setCameraFlyDuration(cameraFlyDuration = 0.5) {
        this._cameraFlyDuration = cameraFlyDuration;
    }

    /**
     * When flying the {@link Camera} to each new axis or diagonal, gets how long, in seconds, that the Camera takes to get there.
     *
     * Default is ````0.5````.
     *
     * @returns {Boolean} Camera flight duration in seconds.
     */
    getCameraFlyDuration() {
        return this._cameraFlyDuration;
    }

    destroy() {
        this.viewer.scene.canvas.off(this._onCanvasBoundary);
        this.viewer.scene.off(this._onSceneTick);
        this.viewer.camera.off(this._onCameraMatrix);
        this.viewer.camera.off(this._onCameraWorldAxis);
        this.viewer.camera.perspective.off(this._onCameraFOV);
        this.viewer.camera.off(this._onCameraProjection);
        this._navCubeCanvas.removeEventListener("mouseenter", this._onMouseEnter);
        this._navCubeCanvas.removeEventListener("mouseleave", this._onMouseLeave);
        this._navCubeCanvas.removeEventListener("mousedown", this._onMouseDown);
        document.removeEventListener("mousemove", this._onMouseMove);
        document.removeEventListener("mouseup", this._onMouseUp);

        super.destroy();
    }
}

export {NavCubePlugin};

