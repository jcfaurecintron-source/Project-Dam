'use client';

import { useState } from 'react';
import MapLive from '../components/MapLive';
import StcMap from '../components/StcMap';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'msa' | 'stc'>('msa');

  return (
    <div className="w-full h-screen flex flex-col">
      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200 shadow-sm z-20">
        <div className="flex">
          <button
            onClick={() => setActiveTab('msa')}
            className={`px-6 py-3 font-medium text-sm transition-colors ${
              activeTab === 'msa'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            MSA Data Map
          </button>
          <button
            onClick={() => setActiveTab('stc')}
            className={`px-6 py-3 font-medium text-sm transition-colors ${
              activeTab === 'stc'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            STC Campuses
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
        {activeTab === 'msa' && <MapLive />}
        {activeTab === 'stc' && <StcMap />}
      </div>
    </div>
  );
}
