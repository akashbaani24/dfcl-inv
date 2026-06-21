import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// PUT update employee
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      return NextResponse.json({ error: 'Only admins and managers can edit employees' }, { status: 403 });
    }

    const { id } = await params;
    const { name, phone, email, address, designation, roles, status, notes } = await request.json();

    const validRoles = ['sales', 'accounts', 'inventory'];
    const roleList = (Array.isArray(roles) ? roles : String(roles || '').split(','))
      .map((r: string) => r.trim().toLowerCase())
      .filter((r: string) => validRoles.includes(r));
    const rolesString = roleList.join(',');

    const employee = await db.employee.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(address !== undefined && { address }),
        ...(designation !== undefined && { designation }),
        ...(roles !== undefined && { roles: rolesString }),
        ...(status !== undefined && { status }),
        ...(notes !== undefined && { notes: notes || null }),
      },
    });

    return NextResponse.json({ employee });
  } catch (error) {
    console.error('Update employee error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE employee
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      return NextResponse.json({ error: 'Only admins and managers can delete employees' }, { status: 403 });
    }

    const { id } = await params;
    await db.employee.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete employee error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
