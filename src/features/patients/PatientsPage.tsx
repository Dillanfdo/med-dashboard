import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDoctors, usePatients } from '@/api/hooks'
import { PatientFormDialog } from '@/features/patients/PatientFormDialog'
import { ageInYears, formatPhone, isMinor } from '@/lib/format'
import { usePermission } from '@/lib/permissions'
import { Badge, Button, QueryState, Select, Input } from '@/components/ui'

export function PatientsPage() {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [minor, setMinor] = useState<'' | 'yes' | 'no'>('')
  const [status, setStatus] = useState('')
  const patients = usePatients({ search, doctorId, minor, status })
  const doctors = useDoctors()
  const all = usePermission('view_all', 'patients')
  const [open, setOpen] = useState(params.get('new') === '1')
  useEffect(() => {
    document.title = 'Patients · Northlight'
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{all ? 'Patients' : 'My patients'}</h1>
          <p className="text-sm text-stone-600">Records stay inside the staff app. Addresses in the browser use opaque ids.</p>
        </div>
        <Button onClick={() => setOpen(true)}>Onboard patient</Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        <Input aria-label="Search patients" placeholder="Name, phone, or id" value={search} onChange={(event) => setSearch(event.target.value)} />
        {all ? (
          <Select aria-label="Doctor" value={doctorId} onChange={(event) => setDoctorId(event.target.value)}>
            <option value="">All doctors</option>
            {(doctors.data ?? []).map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.fullName}</option>)}
          </Select>
        ) : null}
        <Select aria-label="Minor" value={minor} onChange={(event) => setMinor(event.target.value as '' | 'yes' | 'no')}>
          <option value="">Any age</option>
          <option value="yes">Minors</option>
          <option value="no">Adults</option>
        </Select>
        <Select aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Active and closed</option>
          <option value="ACTIVE">Active</option>
          <option value="CLOSED">Closed</option>
        </Select>
      </div>
      <QueryState isLoading={patients.isLoading} isError={patients.isError} error={patients.error} onRetry={() => void patients.refetch()} isEmpty={(patients.data ?? []).length === 0} emptyTitle="No patients" emptyBody="Onboard someone to start a record.">
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-stone-50 text-stone-600"><tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Age</th><th className="px-3 py-2">Phone</th><th className="px-3 py-2">Doctor</th><th className="px-3 py-2">Status</th></tr></thead>
            <tbody>
              {(patients.data ?? []).map((patient) => (
                <tr key={patient.id} className="border-t border-stone-100">
                  <td className="px-3 py-2">
                    <Link className="text-teal-900 underline" to={`/patients/${patient.id}`}>{patient.fullName}</Link>
                    {isMinor(patient.dateOfBirth) ? <Badge tone="amber">Minor</Badge> : null}
                  </td>
                  <td className="px-3 py-2">{ageInYears(patient.dateOfBirth)}</td>
                  <td className="px-3 py-2">{formatPhone(patient.phone)}</td>
                  <td className="px-3 py-2">{doctors.data?.find((item) => item.id === patient.assignedDoctorId)?.fullName}</td>
                  <td className="px-3 py-2">{patient.status === 'ACTIVE' ? 'Active' : 'Closed'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QueryState>
      <PatientFormDialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setParams({}); }} />
    </div>
  )
}
