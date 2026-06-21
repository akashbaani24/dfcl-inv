"""
Split a single-mesh GLB sofa into body + cushion meshes.
Strategy: vertices above the midpoint Y are classified as cushion,
below are body. We then create two separate mesh objects from those
vertex sets, name them appropriately, and re-export as GLB.
"""
import bpy
import bmesh
import sys
import os

def split_glb(input_path, output_path, cushion_name="sofa-cojin", body_name="sofa-body"):
    # Clear scene
    bpy.ops.wm.read_factory_settings(use_empty=True)
    
    # Import GLB
    print(f"Importing: {input_path}")
    bpy.ops.import_scene.gltf(filepath=input_path)
    
    # Find all mesh objects
    mesh_objs = [obj for obj in bpy.data.objects if obj.type == 'MESH']
    print(f"Found {len(mesh_objs)} mesh objects: {[o.name for o in mesh_objs]}")
    
    if len(mesh_objs) == 0:
        print("ERROR: No meshes found!")
        return False
    
    # Get the main mesh (usually the first/largest one)
    main_obj = mesh_objs[0]
    # If there are multiple, pick the one with most vertices
    for obj in mesh_objs:
        if len(obj.data.vertices) > len(main_obj.data.vertices):
            main_obj = obj
    
    print(f"Main mesh: {main_obj.name}, vertices: {len(main_obj.data.vertices)}")
    
    # Get bounding box to find the split point
    bbox = [main_obj.matrix_world @ v.co for v in main_obj.data.vertices]
    min_y = min(v.y for v in bbox)
    max_y = max(v.y for v in bbox)
    mid_y = (min_y + max_y) / 2
    
    print(f"Y range: {min_y:.4f} to {max_y:.4f}, split at: {mid_y:.4f}")
    
    # Enter edit mode
    bpy.context.view_layer.objects.active = main_obj
    bpy.ops.object.select_all(action='DESELECT')
    main_obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    
    # Get bmesh
    me = main_obj.data
    bm = bmesh.from_edit_mesh(me)
    
    # Deselect all
    for v in bm.verts:
        v.select = False
    for f in bm.faces:
        f.select = False
    for e in bm.edges:
        e.select = False
    
    # Select faces ABOVE midpoint (cushion area — top of sofa)
    # We use face center Y position
    cushion_faces = 0
    body_faces = 0
    for f in bm.faces:
        # Face center in world space
        center = main_obj.matrix_world @ f.calc_center_median()
        if center.y > mid_y:
            f.select = True
            cushion_faces += 1
        else:
            body_faces += 1
    
    print(f"Cushion faces: {cushion_faces}, Body faces: {body_faces}")
    
    # Separate selected (cushion) into new object
    if cushion_faces > 0:
        bpy.ops.mesh.separate(type='SELECTED')
    
    bpy.ops.object.mode_set(mode='OBJECT')
    
    # Now we should have 2 mesh objects: original (body) + new (cushion)
    mesh_objs_after = [obj for obj in bpy.data.objects if obj.type == 'MESH']
    print(f"After split: {len(mesh_objs_after)} meshes: {[o.name for o in mesh_objs_after]}")
    
    # Rename: the smaller one (fewer verts) is usually the cushion
    # But we can also check by vertex count — cushion should have fewer
    if len(mesh_objs_after) >= 2:
        # Sort by vertex count
        mesh_objs_after.sort(key=lambda o: len(o.data.vertices))
        # The NEW object (created by separate) is the cushion
        # Find the object that wasn't the original main_obj
        for obj in mesh_objs_after:
            if obj != main_obj:
                obj.name = cushion_name
                print(f"  Renamed {obj.name} → {cushion_name} ({len(obj.data.vertices)} verts)")
        main_obj.name = body_name
        print(f"  Renamed main → {body_name} ({len(main_obj.data.vertices)} verts)")
    
    # Select all meshes for export
    bpy.ops.object.select_all(action='SELECT')
    
    # Export as GLB
    print(f"Exporting: {output_path}")
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_materials='EXPORT',
        export_yup=True,
    )
    
    size = os.path.getsize(output_path)
    print(f"Done! Output: {output_path} ({size/1024:.1f} KB)")
    return True

if __name__ == '__main__':
    # Process both sofa-2 and sofa-3
    base = "/home/z/my-project/public/fabric-studio"
    
    for name in ['sofa-2', 'sofa-3']:
        input_path = f"{base}/{name}.glb"
        output_path = f"{base}/{name}-split.glb"
        print(f"\n{'='*60}")
        print(f"Processing {name}...")
        print(f"{'='*60}")
        success = split_glb(input_path, output_path)
        if success:
            # Replace original with split version
            os.replace(output_path, input_path)
            print(f"Replaced {input_path} with split version")
        else:
            print(f"FAILED to process {name}")
