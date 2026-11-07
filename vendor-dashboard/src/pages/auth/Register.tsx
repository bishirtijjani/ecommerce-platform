import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { AuthLayout } from './AuthLayout';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { vendorRegister } from '../../api/auth';
import type { ApiError } from '../../api/client';

const PHONE_RE = /^0[789][01]\d{8}$/;

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    businessName: '',
    businessPhone: '',
    businessEmail: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.firstName.trim().length < 2) e.firstName = 'Required';
    if (form.lastName.trim().length < 2) e.lastName = 'Required';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Enter a valid email';
    if (!PHONE_RE.test(form.phone)) e.phone = 'Enter a valid Nigerian number (e.g. 08012345678)';
    if (form.password.length < 8) e.password = 'At least 8 characters';
    if (form.businessName.trim().length < 2) e.businessName = 'Required';
    if (form.businessPhone.trim().length < 10) e.businessPhone = 'Required';
    if (!/^\S+@\S+\.\S+$/.test(form.businessEmail)) e.businessEmail = 'Enter a valid email';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const mutation = useMutation({
    mutationFn: () =>
      vendorRegister({
        ...form,
        email: form.email.trim().toLowerCase(),
        businessEmail: form.businessEmail.trim().toLowerCase(),
        openingTime: '08:00',
        closingTime: '22:00',
      }),
    onSuccess: () => navigate('/verify-otp', { state: { email: form.email.trim().toLowerCase() } }),
    onError: (err: ApiError) => setErrors({ form: err.message }),
  });

  return (
    <AuthLayout title="Register your business" subtitle="Set up your shop on Marketplace in a couple of minutes." wide>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (validate()) mutation.mutate();
        }}
      >
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Your details</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="First name" required value={form.firstName} onChange={set('firstName')} error={errors.firstName} />
            <Input label="Last name" required value={form.lastName} onChange={set('lastName')} error={errors.lastName} />
            <Input label="Email" type="email" required value={form.email} onChange={set('email')} error={errors.email} />
            <Input label="Phone" required placeholder="08012345678" value={form.phone} onChange={set('phone')} error={errors.phone} />
            <Input
              label="Password"
              type="password"
              required
              value={form.password}
              onChange={set('password')}
              error={errors.password}
              className="sm:col-span-2"
            />
          </div>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Business details</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Business name" required value={form.businessName} onChange={set('businessName')} error={errors.businessName} className="sm:col-span-2" />
            <Input label="Business phone" required value={form.businessPhone} onChange={set('businessPhone')} error={errors.businessPhone} />
            <Input
              label="Business email"
              type="email"
              required
              value={form.businessEmail}
              onChange={set('businessEmail')}
              error={errors.businessEmail}
              hint="Customers and order notifications use this."
              className="sm:col-span-2"
            />
          </div>
        </div>

        {errors.form && <p className="rounded-md bg-error-soft px-3 py-2 text-sm text-error-strong">{errors.form}</p>}

        <Button type="submit" className="w-full" size="lg" loading={mutation.isPending}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-text-muted">
        Already have a shop?{' '}
        <Link to="/login" className="font-medium text-brand hover:text-brand-strong">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
