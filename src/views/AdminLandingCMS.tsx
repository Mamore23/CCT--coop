import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2 } from 'lucide-react';
import { LandingContent } from '../types';

interface Props {
  token: string;
}

export function AdminLandingCMS({ token }: Props) {
  const [data, setData] = useState<LandingContent>({
    aboutUs: '',
    mission: '',
    vision: '',
    services: [],
    announcements: [],
    testimonials: [],
    faqs: []
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/public/landing-content')
      .then(res => res.json())
      .then(d => {
        if (d.content) setData(d.content);
      })
      .catch(console.error);
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/landing-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        setMsg('Landing page content saved successfully!');
        setTimeout(() => setMsg(''), 3000);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const addAnnouncement = () => {
    setData({
      ...data,
      announcements: [{ id: Date.now().toString(), title: '', content: '', date: new Date().toISOString() }, ...(data.announcements || [])]
    });
  };

  const removeAnnouncement = (id: string) => {
    setData({
      ...data,
      announcements: (data.announcements || []).filter(a => a.id !== id)
    });
  };

  const updateAnnouncement = (id: string, field: string, value: string) => {
    setData({
      ...data,
      announcements: (data.announcements || []).map(a => a.id === id ? { ...a, [field]: value } : a)
    });
  };

  const addFaq = () => {
    setData({
      ...data,
      faqs: [...(data.faqs || []), { question: '', answer: '' }]
    });
  };

  const removeFaq = (idx: number) => {
    setData({
      ...data,
      faqs: (data.faqs || []).filter((_, i) => i !== idx)
    });
  };

  const updateFaq = (idx: number, field: string, value: string) => {
    setData({
      ...data,
      faqs: (data.faqs || []).map((faq, i) => i === idx ? { ...faq, [field]: value } : faq)
    });
  };

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Landing Page CMS</h2>
          <p className="text-sm text-slate-500">Manage public content shown on the landing page</p>
        </div>
        <button onClick={handleSave} disabled={loading} className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700">
          <Save className="w-4 h-4" />
          {loading ? 'Saving...' : 'Save Content'}
        </button>
      </div>

      {msg && <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-bold border border-emerald-200">{msg}</div>}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">About Us / Hero Text</label>
          <textarea 
            className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" 
            rows={3} 
            value={data.aboutUs || ''}
            onChange={e => setData({...data, aboutUs: e.target.value})}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Our Mission</label>
            <textarea 
              className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" 
              rows={4} 
              value={data.mission || ''}
              onChange={e => setData({...data, mission: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Our Vision</label>
            <textarea 
              className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" 
              rows={4} 
              value={data.vision || ''}
              onChange={e => setData({...data, vision: e.target.value})}
            />
          </div>
        </div>
      </div>

      
      <div className="pt-6 border-t border-slate-200">
        <h3 className="text-md font-bold text-slate-900 mb-4">Social Media Links</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Facebook URL</label>
            <input type="url" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={data.facebookUrl || ''} onChange={e => setData({...data, facebookUrl: e.target.value})} placeholder="https://facebook.com/..." />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Twitter URL</label>
            <input type="url" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={data.twitterUrl || ''} onChange={e => setData({...data, twitterUrl: e.target.value})} placeholder="https://twitter.com/..." />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Instagram URL</label>
            <input type="url" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={data.instagramUrl || ''} onChange={e => setData({...data, instagramUrl: e.target.value})} placeholder="https://instagram.com/..." />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">LinkedIn URL</label>
            <input type="url" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={data.linkedinUrl || ''} onChange={e => setData({...data, linkedinUrl: e.target.value})} placeholder="https://linkedin.com/..." />
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-md font-bold text-slate-900">Announcements & News</h3>
          <button onClick={addAnnouncement} className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold flex items-center gap-1 hover:bg-slate-200">
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
        <div className="space-y-4">
          {(data.announcements || []).map(a => (
            <div key={a.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl relative">
              <button onClick={() => removeAnnouncement(a.id)} className="absolute top-4 right-4 text-rose-500 hover:text-rose-700">
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Title</label>
                  <input type="text" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={a.title} onChange={e => updateAnnouncement(a.id, 'title', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
                  <input type="date" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={a.date ? a.date.split('T')[0] : ''} onChange={e => updateAnnouncement(a.id, 'date', new Date(e.target.value).toISOString())} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Content</label>
                <textarea className="w-full p-2 border border-slate-200 rounded-lg text-sm" rows={2} value={a.content} onChange={e => updateAnnouncement(a.id, 'content', e.target.value)} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-6 border-t border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-md font-bold text-slate-900">Frequently Asked Questions</h3>
          <button onClick={addFaq} className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold flex items-center gap-1 hover:bg-slate-200">
            <Plus className="w-4 h-4" /> Add FAQ
          </button>
        </div>
        <div className="space-y-4">
          {(data.faqs || []).map((faq, idx) => (
            <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl relative">
              <button onClick={() => removeFaq(idx)} className="absolute top-4 right-4 text-rose-500 hover:text-rose-700">
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="space-y-3 mr-8">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Question</label>
                  <input type="text" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={faq.question} onChange={e => updateFaq(idx, 'question', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Answer</label>
                  <textarea className="w-full p-2 border border-slate-200 rounded-lg text-sm" rows={2} value={faq.answer} onChange={e => updateFaq(idx, 'answer', e.target.value)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
