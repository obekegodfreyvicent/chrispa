'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth-client';
import { Card } from '@/components/ui';
import { EmployeeForm } from '../employee-form';

export default function NewEmployeePage() {
  const [authed, setAuthed] = useState(true);

  useEffect(() => {
    setAuthed(!!getAccessToken());
  }, []);

  if (!authed) {
    return (
      <Card>
        <p className="text-sm text-text-2">
          <Link href="/login" className="text-gold-light">Log in</Link> as Owner or HR Manager.
        </p>
      </Card>
    );
  }

  return (
    <div>
      <h1 className="font-serif text-xl mb-4">Add Employee</h1>
      <EmployeeForm />
    </div>
  );
}
