'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Card, CardBody, CardHeader, EmptyState } from '@/components/ui/index.jsx';
import { Button, Input } from '@/components/ui/interactive.jsx';
import { addServiceArea, deleteServiceArea } from '@/actions/milkman.actions.js';

/**
 * Modern Delivery Routes & Service Area Manager for Milkman Panel.
 * Allows adding, managing, and removing delivery sectors and pincodes.
 */
export function RoutesManager({ initialAreas = [] }) {
  const [areas, setAreas] = useState(initialAreas);
  const [showAddModal, setShowAddModal] = useState(false);
  const [pending, startTransition] = useTransition();

  async function handleAddArea(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const data = {
      areaName: formData.get('areaName'),
      pincode: formData.get('pincode'),
      city: formData.get('city') || 'Gurgaon',
      state: formData.get('state') || 'Haryana',
      routeSequence: Number(formData.get('routeSequence')) || 0,
    };

    startTransition(async () => {
      const res = await addServiceArea(data);
      if (res.ok) {
        toast.success(`Route ${data.areaName} (${data.pincode}) added successfully!`);
        setShowAddModal(false);
        // Refresh local state
        setAreas((prev) => [...prev, res.data || data]);
      } else {
        toast.error(res.message || 'Could not add service area.');
      }
    });
  }

  async function handleDeleteArea(id, name) {
    if (!confirm(`Are you sure you want to remove ${name} from your delivery routes?`)) return;

    startTransition(async () => {
      const res = await deleteServiceArea({ id });
      if (res.ok) {
        toast.success(`Route ${name} removed.`);
        setAreas((prev) => prev.filter((a) => a.id !== id));
      } else {
        toast.error(res.message || 'Could not remove route.');
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            Delivery Routes & Sectors
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600">
            Configure the sectors, societies, and pincodes where you deliver morning milk.
          </p>
        </div>

        <Button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 hover:bg-blue-700 font-semibold shadow-md shadow-blue-600/20"
        >
          <span>+ Add New Route</span>
        </Button>
      </div>

      {/* Add Route Card / Form */}
      {showAddModal && (
        <Card className="border-2 border-blue-200 bg-white p-6 shadow-xl shadow-blue-500/5 animate-scale-in rounded-3xl">
          <CardHeader
            title="Add Delivery Sector / Area"
            description="Customers in this sector and pincode will be able to discover your dairy and subscribe."
            action={
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-700"
              >
                ✕ Close
              </button>
            }
          />
          <CardBody className="pt-4">
            <form onSubmit={handleAddArea} className="grid gap-4 sm:grid-cols-2">
              <Input
                name="areaName"
                label="Sector / Society / Area Name"
                placeholder="e.g. Sector 59, Sector 79, Palm Heights"
                required
                autoFocus
              />

              <Input
                name="pincode"
                label="Pincode (6-Digit)"
                inputMode="numeric"
                maxLength={6}
                pattern="\d{6}"
                placeholder="e.g. 122001"
                required
              />

              <Input
                name="city"
                label="City"
                defaultValue="Gurgaon"
                placeholder="City name"
                required
              />

              <Input
                name="state"
                label="State"
                defaultValue="Haryana"
                placeholder="State name"
                required
              />

              <div className="sm:col-span-2">
                <Input
                  name="routeSequence"
                  type="number"
                  label="Morning Route Sequence (Order you visit this sector)"
                  defaultValue="1"
                  min="0"
                  hint="Lower number means delivered earlier in the morning round."
                />
              </div>

              <div className="sm:col-span-2 flex items-center justify-end gap-3 pt-2">
                <Button variant="outline" type="button" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={pending} className="bg-blue-600 hover:bg-blue-700 font-semibold">
                  Save Delivery Route →
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {/* Routes Grid / List */}
      {areas.length === 0 ? (
        <EmptyState
          icon={
            <svg className="h-10 w-10 text-slate-400 fill-current" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
          }
          title="No delivery routes added yet"
          description="Add your first delivery sector (e.g. Sector 59 or Sector 79) and pincode so households can find your dairy."
          action={
            <Button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-700">
              Add First Route
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {areas.map((area, idx) => (
            <Card
              key={area.id || idx}
              className="border border-slate-200 bg-white shadow-sm hover:border-blue-400 transition-all rounded-2xl overflow-hidden"
            >
              <CardBody className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                      Stop #{area.routeSequence || idx + 1}
                    </span>
                    <h3 className="font-heading text-lg font-bold text-slate-900 mt-1">
                      {area.areaName}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteArea(area.id, area.areaName)}
                    className="text-slate-400 hover:text-red-600 p-1 transition-colors"
                    title="Remove Route"
                  >
                    <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-1 text-xs text-slate-600 border-t border-slate-100 pt-3">
                  <div className="flex justify-between">
                    <span>Pincode:</span>
                    <span className="font-mono font-bold text-slate-900">{area.pincode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Region:</span>
                    <span className="font-semibold text-slate-800">{area.city}, {area.state}</span>
                  </div>
                  <div className="flex justify-between text-blue-600 font-semibold pt-1">
                    <span>Status:</span>
                    <span className="flex items-center gap-1 text-emerald-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                      Active for Discovery
                    </span>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
