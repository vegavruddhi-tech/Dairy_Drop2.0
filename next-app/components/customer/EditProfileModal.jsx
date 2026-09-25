'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Modal, Button, Input, Textarea } from '@/components/ui/interactive.jsx';
import { updateCustomerProfile } from '@/actions/customer.actions.js';

export function EditProfileModal({ open, onClose, customer }) {
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(customer?.name || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [line1, setLine1] = useState(customer?.addressLine1 || '');
  const [line2, setLine2] = useState(customer?.addressLine2 || '');
  const [area, setArea] = useState(customer?.addressArea || customer?.deliveryArea || '');
  const [city, setCity] = useState(customer?.addressCity || '');
  const [state, setState] = useState(customer?.addressState || '');
  const [pincode, setPincode] = useState(customer?.addressPincode || '');
  const [landmark, setLandmark] = useState(customer?.addressLandmark || '');
  const [deliveryInstructions, setDeliveryInstructions] = useState(
    customer?.deliveryInstructions || '',
  );

  const handleSubmit = (e) => {
    e.preventDefault();

    startTransition(async () => {
      const res = await updateCustomerProfile({
        name: name.trim(),
        phone: phone.trim(),
        line1: line1.trim(),
        line2: line2.trim() || undefined,
        area: area.trim(),
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        pincode: pincode.trim(),
        landmark: landmark.trim() || undefined,
        deliveryInstructions: deliveryInstructions.trim() || undefined,
      });

      if (res.ok) {
        toast.success('Profile and delivery address updated successfully!');
        onClose();
      } else {
        toast.error(res.message || 'Failed to update profile.');
      }
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Profile & Delivery Address"
      footer={
        <div className="flex w-full items-center justify-end gap-2.5">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button form="edit-profile-form" type="submit" loading={pending} className="font-bold">
            Save Changes
          </Button>
        </div>
      }
    >
      <form id="edit-profile-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Personal Details */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Personal Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Prasad Shashwat"
              required
            />
            <Input
              label="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit mobile number"
              required
            />
          </div>
        </div>

        {/* Address Details */}
        <div className="pt-2 border-t border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Delivery Address
          </h3>
          <div className="space-y-3">
            <Input
              label="House / Flat / Street (Line 1)"
              value={line1}
              onChange={(e) => setLine1(e.target.value)}
              placeholder="Flat 402, Block B, Green Heights"
              required
            />
            <Input
              label="Street / Landmark (Line 2)"
              value={line2}
              onChange={(e) => setLine2(e.target.value)}
              placeholder="Near Main Market (Optional)"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Sector / Area"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="e.g. Sector 56"
                required
              />
              <Input
                label="6-Digit Pincode"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="122011"
                maxLength={6}
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
              />
              <Input
                label="Landmark"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="Opposite Community Park"
              />
            </div>
          </div>
        </div>

        {/* Delivery Instructions */}
        <div className="pt-2 border-t border-slate-100">
          <Textarea
            label="Delivery Instructions (Optional)"
            value={deliveryInstructions}
            onChange={(e) => setDeliveryInstructions(e.target.value)}
            placeholder="e.g. Please leave milk bottle inside the insulated door bag. Ring bell once."
            rows={2}
          />
        </div>
      </form>
    </Modal>
  );
}
