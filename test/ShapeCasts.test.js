
import {
	Mesh,
	BufferGeometry,
	SphereBufferGeometry,
	Vector3,
	Quaternion,
	Matrix4,
	Sphere,
	Box3,
	Euler,
	Raycaster,
	Scene,
	TorusBufferGeometry,
	MeshBasicMaterial,
	BoxBufferGeometry,
	FrontSide,
	BackSide,
} from 'three';
import {
	MeshBVH as _MeshBVH,
	acceleratedRaycast,
	computeBoundsTree,
	disposeBoundsTree,
	CONTAINED,
	INTERSECTED,
	NOT_INTERSECTED,
} from '../src/index.js';

Mesh.prototype.raycast = acceleratedRaycast;
BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;

runSuiteWithOptions( {} );

function runSuiteWithOptions( defaultOptions ) {

	const MeshBVH = class extends _MeshBVH {

		constructor( geometry, options ) {

			super( geometry, Object.assign( {}, defaultOptions, options ) );

		}

	};

	describe( 'Shapecast containment', () => {

		let bvh = null;
		let intersectGeometry = null;

		function getIntersectsBoxFunction( sphere ) {

			const tempVec = new Vector3();
			return box => {

				const intersects = sphere.intersectsBox( box );
				const { min, max } = box;
				if ( intersects ) {

					for ( let x = 0; x <= 1; x ++ ) {

						for ( let y = 0; y <= 1; y ++ ) {

							for ( let z = 0; z <= 1; z ++ ) {

								tempVec.set(
									x === 0 ? min.x : max.x,
									y === 0 ? min.y : max.y,
									z === 0 ? min.z : max.z
								);
								if ( ! sphere.containsPoint( tempVec ) ) {

									return INTERSECTED;

								}

							}

						}

					}

					return CONTAINED;

				}

				return intersects ? INTERSECTED : NOT_INTERSECTED;

			};

		}

		beforeAll( () => {

			const geom = new SphereBufferGeometry( 1, 50, 50 );
			bvh = new MeshBVH( geom, { verbose: false } );
			intersectGeometry = new SphereBufferGeometry( 1, 50, 50 );
			intersectGeometry.computeBoundsTree();

		} );

		it( 'should return that all triangles are contained if the bounds are within the shape.', () => {

			const sphere = new Sphere();
			sphere.radius = 3;

			let allContained = true;
			let numContained = 0;
			bvh.shapecast(
				{
					intersectsBounds: getIntersectsBoxFunction( sphere ),
					intersectsTriangle: ( tri, index, contained ) => {

						allContained = contained && allContained;
						numContained ++;

					}
				}
			);

			expect( allContained ).toBeTruthy();
			expect( numContained ).toEqual( 4900 );

		} );

		it( 'should return that all triangles are not contained within the bounds shape.', () => {

			const sphere = new Sphere();
			sphere.radius = 3;
			sphere.center.x = 3;

			let allContained = true;
			let numContained = 0;
			bvh.shapecast(
				{
					intersectsBounds: getIntersectsBoxFunction( sphere ),
					intersectsTriangle: ( tri, index, contained ) => {

						allContained = contained && allContained;
						if ( contained ) {

							numContained ++;

						}

					}
				}
			);

			expect( allContained ).toBeFalsy();
			expect( numContained ).toEqual( 1540 );

		} );

		it( 'should return that no triangles are contained within the bounds shape.', () => {

			const sphere = new Sphere();
			sphere.radius = 3;
			sphere.center.x = 5.99;

			let trianglesIterated = 0;
			bvh.shapecast(
				{
					intersectsBounds: getIntersectsBoxFunction( sphere ),
					intersectsTriangle: () => {

						trianglesIterated ++;

					}
				}
			);

			expect( trianglesIterated ).toEqual( 0 );

		} );

		it( 'should not use the same triangle twice when being recursively called.', () => {

			const geometry = new SphereBufferGeometry();
			const bvh = new MeshBVH( geometry );

			let checks = 0;
			bvh.shapecast( {

				intersectsBounds: () => true,
				intersectsTriangle: tri => {

					bvh.shapecast( {

						intersectsBounds: () => true,
						intersectsTriangle: tri2 => {

							expect( tri2 ).not.toBe( tri );
							checks ++;
							return true;

						}

					} );

					return true;

				}

			} );

			expect( checks ).not.toBe( 0 );

		} );

		it( 'should not use the same box twice when being recursively called.', () => {

			const geometry = new SphereBufferGeometry();
			const bvh = new MeshBVH( geometry );

			let boundsChecks = 0;
			let rangeChecks = 0;
			bvh.shapecast( {

				intersectsBounds: box1 => {

					bvh.shapecast( {

						intersectsBounds: box2 => {

							expect( box1 ).not.toBe( box2 );
							boundsChecks ++;
							return true;

						},

						intersectsRange: ( offset, count, contained, depth, nodeIndex, box2 ) => {

							expect( box1 ).not.toBe( box2 );
							boundsChecks ++;
							return true;

						}

					} );
					return true;

				},
				intersectsRange: ( offset, count, contained, depth, nodeIndex, box1 ) => {

					bvh.shapecast( {

						intersectsBounds: box2 => {

							expect( box1 ).not.toBe( box2 );
							rangeChecks ++;
							return true;

						},

						intersectsRange: ( offset, count, contained, depth, nodeIndex, box2 ) => {

							expect( box1 ).not.toBe( box2 );
							rangeChecks ++;
							return true;

						}

					} );

					return true;

				}

			} );

			expect( rangeChecks ).not.toEqual( 0 );
			expect( boundsChecks ).not.toEqual( 0 );

		} );

	} );

	describe( 'IntersectsGeometry with BVH', () => {

		let bvh = null;
		let intersectGeometry = null;

		beforeAll( () => {

			const geom = new SphereBufferGeometry( 1, 50, 50 );
			bvh = new MeshBVH( geom, { verbose: false } );
			intersectGeometry = new SphereBufferGeometry( 1, 50, 50 );
			intersectGeometry.computeBoundsTree();

		} );

		it( 'should return true if the geometry is intersecting the mesh', () => {

			const geomToWorld = new Matrix4()
				.compose(
					new Vector3( 0, 1, 0 ),
					new Quaternion(),
					new Vector3( 0.1, 0.1, 0.1 ) );

			expect( bvh.intersectsGeometry( intersectGeometry, geomToWorld ) ).toBe( true );

		} );

		it( 'should return false if the geometry is not intersecting the mesh', () => {

			const geomToWorld = new Matrix4()
				.compose(
					new Vector3( 0, 1.2, 0 ),
					new Quaternion(),
					new Vector3( 0.1, 0.1, 0.1 ) );

			expect( bvh.intersectsGeometry( intersectGeometry, geomToWorld ) ).toBe( false );

		} );

		it( 'should return false if the geometry is contained by the mesh entirely', () => {

			const geomToWorld = new Matrix4()
				.compose(
					new Vector3( 0, 0, 0 ),
					new Quaternion(),
					new Vector3( 0.5, 0.5, 0.5 ) );

			expect( bvh.intersectsGeometry( intersectGeometry, geomToWorld ) ).toBe( false );

		} );

		it( 'should return true if the geometry overlaps exactly', () => {

			const geomToWorld = new Matrix4().identity();

			expect( bvh.intersectsGeometry( intersectGeometry, geomToWorld ) ).toBe( true );

		} );

	} );


	describe( 'IntersectsGeometry', () => {

		let bvh = null;
		let intersectGeometry = null;

		beforeAll( () => {

			const geom = new SphereBufferGeometry( 1, 50, 50 );
			bvh = new MeshBVH( geom, { verbose: false } );
			intersectGeometry = new SphereBufferGeometry( 1, 50, 50 );

		} );

		it( 'should return true if the geometry is intersecting the mesh', () => {

			const geomToWorld = new Matrix4()
				.compose(
					new Vector3( 0, 1, 0 ),
					new Quaternion(),
					new Vector3( 0.1, 0.1, 0.1 ) );

			expect( bvh.intersectsGeometry( intersectGeometry, geomToWorld ) ).toBe( true );

		} );

		it( 'should return false if the geometry is not intersecting the mesh', () => {

			const geomToWorld = new Matrix4()
				.compose(
					new Vector3( 0, 1.2, 0 ),
					new Quaternion(),
					new Vector3( 0.1, 0.1, 0.1 ) );

			expect( bvh.intersectsGeometry( intersectGeometry, geomToWorld ) ).toBe( false );

		} );

		it( 'should return false if the geometry is contained by the mesh entirely', () => {

			const geomToWorld = new Matrix4()
				.compose(
					new Vector3( 0, 0, 0 ),
					new Quaternion(),
					new Vector3( 0.5, 0.5, 0.5 ) );

			expect( bvh.intersectsGeometry( intersectGeometry, geomToWorld ) ).toBe( false );

		} );

		it( 'should return true if the geometry overlaps exactly', () => {

			const geomToWorld = new Matrix4().identity();

			expect( bvh.intersectsGeometry( intersectGeometry, geomToWorld ) ).toBe( true );

		} );

	} );

	describe( 'IntersectsSphere', () => {

		let bvh = null;

		beforeAll( () => {

			const geom = new SphereBufferGeometry( 1, 50, 50 );
			bvh = new MeshBVH( geom, { verbose: false } );

		} );

		it( 'should return true if the sphere is intersecting the mesh', () => {

			const sphere = new Sphere();
			sphere.radius = .01;
			sphere.center.set( 0, 1, 0 );
			expect( bvh.intersectsSphere( sphere ) ).toBe( true );

		} );

		it( 'should return false if the sphere is inside the mesh', () => {

			const sphere = new Sphere();
			sphere.radius = 0.9;
			sphere.center.set( 0, 0, 0 );
			expect( bvh.intersectsSphere( sphere ) ).toBe( false );

		} );

		it( 'should return false if the sphere is outside the mesh', () => {

			const sphere = new Sphere();
			sphere.radius = 0.9;
			sphere.center.set( 0, 2.01, 0 );
			expect( bvh.intersectsSphere( sphere ) ).toBe( false );

		} );

	} );

	describe( 'IntersectsBox', () => {

		let bvh = null;

		beforeAll( () => {

			const geom = new SphereBufferGeometry( 1, 50, 50 );
			bvh = new MeshBVH( geom, { verbose: false } );

		} );

		it( 'should return false if the box is outside the mesh', () => {

			const box = new Box3();
			box.min.set( - 1, - 1, - 1 );
			box.max.set( 1, 1, 1 );

			const boxToWorld = new Matrix4()
				.compose(
					new Vector3( 0, 3, 0 ),
					new Quaternion().setFromEuler( new Euler( Math.PI / 4, Math.PI / 4, 0 ) ),
					new Vector3( 1, 1, 1 ) );

			expect( bvh.intersectsBox( box, boxToWorld ) ).toBe( false );

		} );

		it( 'should return true if one corner is inside the mesh', () => {

			const box = new Box3();
			box.min.set( - 1, - 1, - 1 );
			box.max.set( 1, 1, 1 );

			const boxToWorld = new Matrix4()
				.compose(
					new Vector3( 0, 2, 0 ),
					new Quaternion().setFromEuler( new Euler( Math.PI / 4, Math.PI / 4, 0 ) ),
					new Vector3( 1, 1, 1 ) );

			expect( bvh.intersectsBox( box, boxToWorld ) ).toBe( true );

		} );

		it( 'should return true if the box encapsulates the mesh entirely', () => {

			const box = new Box3();
			box.min.set( - 10, - 10, - 10 );
			box.max.set( 10, 10, 10 );

			const boxToWorld = new Matrix4()
				.compose(
					new Vector3( 0, 0, 0 ),
					new Quaternion().setFromEuler( new Euler( Math.PI / 4, Math.PI / 4, 0 ) ),
					new Vector3( 1, 1, 1 ) );

			expect( bvh.intersectsBox( box, boxToWorld ) ).toBe( true );

		} );

		it( 'should return false if the box inside the mesh entirely', () => {

			const box = new Box3();
			box.min.set( - .5, - .5, - .5 );
			box.max.set( .5, .5, .5 );

			const boxToWorld = new Matrix4()
				.compose(
					new Vector3( 0, 0, 0 ),
					new Quaternion().setFromEuler( new Euler( Math.PI / 4, Math.PI / 4, 0 ) ),
					new Vector3( 1, 1, 1 ) );

			expect( bvh.intersectsBox( box, boxToWorld ) ).toBe( false );

		} );

		it( 'should return true if the box intersects it with a side only', () => {

			const box = new Box3();
			box.min.set( - 10, 0, - 10 );
			box.max.set( 10, 10, 10 );

			const boxToWorld = new Matrix4()
				.compose(
					new Vector3( 0, 0, 0 ),
					new Quaternion().setFromEuler( new Euler( Math.PI / 4, Math.PI / 4, 0 ) ),
					new Vector3( 1, 1, 1 ) );

			expect( bvh.intersectsBox( box, boxToWorld ) ).toBe( true );

		} );

	} );

	describe( 'Distance To Point', () => {

		// error to account for the geometry
		// not being perfectly round
		const EPSILON = 0.001;
		let bvh = null;
		let target = undefined;

		beforeAll( () => {

			const geom = new SphereBufferGeometry( 1, 200, 200 );
			bvh = new MeshBVH( geom, { verbose: false } );

		} );

		it( 'should return the radius if at the center of the geometry', () => {

			target = bvh.closestPointToPoint( new Vector3(), target );
			const dist = target.distance;
			expect( dist ).toBeLessThanOrEqual( 1 );
			expect( dist ).toBeGreaterThanOrEqual( 1 - EPSILON );

		} );

		it( 'should return 0 if on the surface of the geometry', () => {

			target = bvh.closestPointToPoint( new Vector3( 0, 1, 0 ), target );
			const dist = target.distance;
			expect( dist ).toBe( 0 );

		} );

		it( 'should return the distance to the surface', () => {

			const vec = new Vector3();
			for ( let i = 0; i < 100; i ++ ) {

				vec.x = Math.random() - 0.5;
				vec.y = Math.random() - 0.5;
				vec.z = Math.random() - 0.5;

				const length = Math.random() * 3;
				vec.normalize().multiplyScalar( length );

				const expectedDist = Math.abs( 1 - length );
				target = bvh.closestPointToPoint( vec, target );
				const dist = target.distance;
				expect( dist ).toBeLessThanOrEqual( expectedDist + EPSILON );
				expect( dist ).toBeGreaterThanOrEqual( expectedDist - EPSILON );

			}

		} );

	} );

	describe( 'Distance To Geometry', () => {

		let geometry = null;
		let bvh = null;
		let target1 = undefined;
		let target2 = undefined;

		beforeEach( () => {

			const geom = new SphereBufferGeometry( 1, 20, 20 );
			bvh = new MeshBVH( geom, { verbose: false } );

			target2 = { };

			geometry = new SphereBufferGeometry( 1, 5, 5 );

		} );

		it( 'should return the radius if reduced to a point at the center of the geometry', () => {

			// error to account for neither geometries
			// being perfectly round
			const EPSILON = 0.05;
			const matrix = new Matrix4()
				.compose(
					new Vector3(),
					new Quaternion(),
					new Vector3( 0.001, 0.001, 0.001 )
				);
			target1 = bvh.closestPointToGeometry( geometry, matrix, target1, target2 );
			const dist = target1.distance;
			expect( dist ).toBeLessThanOrEqual( 1 );
			expect( dist ).toBeGreaterThanOrEqual( 1 - EPSILON );

		} );

		it( 'should return 0 if intersecting the geometry', () => {

			const matrix = new Matrix4()
				.compose(
					new Vector3( 0, 1, 0 ),
					new Quaternion(),
					new Vector3( 0.1, 0.1, 0.1 )
				);
			target1 = bvh.closestPointToGeometry( geometry, matrix, target1, target2 );
			const dist = target1.distance;
			expect( dist ).toBe( 0 );

		} );


		it( 'should return the distance to the surface', () => {

			// error to account for neither geometries
			// being perfectly round
			const EPSILON = 0.1;
			const radius = 0.1;
			const pos = new Vector3();
			const quat = new Quaternion();
			const sca = new Vector3( radius, radius, radius );
			const matrix = new Matrix4();

			for ( let i = 0; i < 10; i ++ ) {

				pos.x = Math.random() - 0.5;
				pos.y = Math.random() - 0.5;
				pos.z = Math.random() - 0.5;

				const length = Math.random() * 3;
				pos.normalize().multiplyScalar( length );

				matrix.compose( pos, quat, sca );

				const distToCenter = Math.abs( 1 - length );
				const expectedDist = distToCenter < radius ? 0 : distToCenter - radius;
				target1 = bvh.closestPointToGeometry( geometry, matrix, target1, target2 );
				const dist = target1.distance;
				expect( dist ).toBeLessThanOrEqual( expectedDist + EPSILON );
				expect( dist ).toBeGreaterThanOrEqual( expectedDist - EPSILON );

			}

		} );

	} );

	describe( 'Raycaster', () => {

		let geometry = null;
		let mesh = null;
		let scene = null;
		let raycaster = null;
		beforeEach( () => {

			raycaster = new Raycaster();
			raycaster.ray.origin.set( 0, 0, - 10 );
			raycaster.ray.direction.set( 0, 0, 1 );

			scene = new Scene();
			geometry = new TorusBufferGeometry( 5, 5, 40, 10 );
			mesh = new Mesh( geometry, new MeshBasicMaterial() );

			scene.add( mesh );

			for ( let i = 0; i < 10; i ++ ) {

				scene.add( mesh.clone() );

			}

		} );

		describe( 'firstHitOnly = false', () => {

			beforeEach( () => {

				raycaster.firstHitOnly = false;

			} );

			it( 'should yield all hits on an a mesh without a bounds tree', () => {

				const arr = [];
				mesh.raycast( raycaster, arr );
				expect( arr ).toHaveLength( 10 );

			} );

			it( 'should yield all hits on an a mesh with a bounds tree', () => {

				geometry.computeBoundsTree();

				const arr = [];
				mesh.raycast( raycaster, arr );
				expect( arr ).toHaveLength( 10 );

			} );

			it( 'should yield all hits in a scene', () => {

				const res = raycaster.intersectObject( scene, true );
				expect( res ).toHaveLength( 110 );

			} );

			it( 'should support correct use of groups', () => {

				const backSideMaterial = new MeshBasicMaterial( {
					side: BackSide,
				} );

				const frontSideMaterial = new MeshBasicMaterial( {
					side: FrontSide,
				} );

				const box = new Mesh(
					new BoxBufferGeometry(),
					[
						backSideMaterial, frontSideMaterial,
						backSideMaterial, frontSideMaterial,
						backSideMaterial, frontSideMaterial,
					],
				);

				const raycaster = new Raycaster();
				raycaster.ray.origin.set( 0, 0.25, - 10 );
				raycaster.ray.direction.set( 0, 0, 1 );

				// all hits
				const results = raycaster.intersectObject( box, true );
				box.geometry.computeBoundsTree();
				const results2 = raycaster.intersectObject( box, true );

				expect( results ).toEqual( results2 );
				expect( results ).toHaveLength( 2 );

				// first hit
				raycaster.firstHitOnly = true;
				box.material = [
					frontSideMaterial, frontSideMaterial,
					frontSideMaterial, frontSideMaterial,
					backSideMaterial, backSideMaterial,
				];

				box.geometry.disposeBoundsTree();
				const firstHit = raycaster.intersectObject( box, true )[ 0 ];

				box.geometry.computeBoundsTree();
				const firstHit2 = raycaster.intersectObject( box, true )[ 0 ];

				expect( firstHit ).toEqual( firstHit2 );
				expect( firstHit.point.z ).toEqual( 0.5 );

			} );

		} );

		describe( 'firstHitOnly = true', () => {

			it( 'should yield closest hit only with a bounds tree', () => {

				const bvh = new MeshBVH( geometry );

				geometry.boundsTree = bvh;
				raycaster.firstHitOnly = true;
				const bvhHits = raycaster.intersectObject( mesh, true );

				raycaster.firstHitOnly = false;
				const allHits = raycaster.intersectObject( mesh, true );

				expect( allHits ).toHaveLength( 10 );
				expect( bvhHits ).toHaveLength( 1 );

				expect( bvhHits[ 0 ] ).toEqual( allHits[ 0 ] );

			} );

		} );

	} );

}
