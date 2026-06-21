import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/employees?role=sales&status=active
// Returns list of employees, optionally filtered by role and status.
// `role` filter matches if the role appears anywhere in the comma-separated roles field.
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const roleFilter = searchParams.get('role') || '';
    const statusFilter = searchParams.get('status') || '';
    const search = searchParams.get('search') || '';

    const where: Record<string, unknown> = {};
    if (statusFilter) where.status = statusFilter;
    if (search.trim()) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
        { designation: { contains: search } },
      ];
    }

    let employees = await db.employee.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Apply role filter in JS (since roles is comma-separated, not a relation)
    if (roleFilter) {
      employees = employees.filter(e => {
        const roles = (e.roles || '').split(',').map(r => r.trim().toLowerCase());
        return roles.includes(roleFilter.toLowerCase());
      });
    }

    return NextResponse.json({ employees });
  } catch (error) {
    console.error('Get employees error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST create new employee (admin/manager only)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      return NextResponse.json({ error: 'Only admins and managers can create employees' }, { status: 403 });
    }

    const { name, phone, email, address, designation, roles, status, notes } = await request.json();
    if (!name) {
      return NextResponse.json({ error: 'Employee name is required' }, { status: 400 });
    }

    // Validate roles — only allow these values
    const validRoles = ['sales', 'accounts', 'inventory'];
    const roleList = (Array.isArray(roles) ? roles : String(roles || '').split(','))
      .map((r: string) => r.trim().toLowerCase())
      .filter((r: string) => validRoles.includes(r));
    const rolesString = roleList.join(',');

    const employee = await db.employee.create({
      data: {
        name,
        phone: phone || '',
        email: email || '',
        address: address || '',
        designation: designation || '',
        roles: rolesString,
        status: status || 'active',
        notes: notes || null,
      },
    });

    return NextResponse.json({ employee });
  } catch (error) {
    console.error('Create employee error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
