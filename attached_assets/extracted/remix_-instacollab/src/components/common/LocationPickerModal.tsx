import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Search } from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationSelect: (locationUrl: string, locationName?: string) => void;
}

function CheckoutLayout({ onClose, onLocationSelect }: { onClose: () => void, onLocationSelect: (url: string, name?: string) => void }) {
  const map = useMap();
  const geocodingLib = useMapsLibrary('geocoding');
  const placesLib = useMapsLibrary('places');
  const [markerPos, setMarkerPos] = useState<google.maps.LatLngLiteral>({ lat: 28.43268, lng: 77.0459 });
  const [landmarks, setLandmarks] = useState<any[]>([]);
  const [selectedLandmarkIdx, setSelectedLandmarkIdx] = useState(0);
  const [geocodingError, setGeocodingError] = useState<string | null>(null);

  const [form, setForm] = useState({
    address: '',
    aptSuite: '',
    city: '',
    stateProvince: '',
    zipPostalCode: '',
    country: '',
  });

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!placesLib || !inputRef.current) return;
    const autocomplete = new placesLib.Autocomplete(inputRef.current, {
      fields: ['place_id', 'address_components', 'formatted_address', 'geometry', 'name']
    });
    
    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place.geometry) return;
      
      const pos = place.geometry.location?.toJSON();
      if (pos) {
        setMarkerPos(pos);
        if (map) {
          map.setCenter(pos);
          map.setZoom(16);
        }
        geocodeLocation(pos, place.place_id);
      }

      // fill in address
      let newForm = { address: '', aptSuite: '', city: '', stateProvince: '', zipPostalCode: '', country: '' };
      if (place.address_components) {
        for (const component of place.address_components) {
          const componentType = component.types[0];
          switch (componentType) {
            case 'street_number':
              newForm.address = `${component.long_name} `;
              break;
            case 'route':
              newForm.address += component.short_name;
              break;
            case 'premise':
            case 'subpremise':
              newForm.aptSuite = component.short_name;
              break;
            case 'locality':
              newForm.city = component.long_name;
              break;
            case 'administrative_area_level_1':
              newForm.stateProvince = component.short_name;
              break;
            case 'postal_code':
              newForm.zipPostalCode = component.long_name;
              break;
            case 'country':
              newForm.country = component.long_name;
              break;
          }
        }
      }
      setForm(newForm);
      if (inputRef.current) inputRef.current.value = newForm.address;
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [placesLib, map]);

  const geocodeLocation = async (pos: google.maps.LatLngLiteral, placeId?: string) => {
    if (!geocodingLib) return;
    const geocoder = new geocodingLib.Geocoder();
    try {
      const req: google.maps.GeocoderRequest = placeId 
        ? { placeId: placeId, extraComputations: ['ADDRESS_DESCRIPTORS'], fulfillOnZeroResults: true } as any
        : { location: pos, extraComputations: ['ADDRESS_DESCRIPTORS'], fulfillOnZeroResults: true } as any;

      const response = await geocoder.geocode(req);
      if (response.results && response.results.length > 0) {
        const place = response.results[0];
        const descriptor = (place as any).address_descriptor;
        if (descriptor && descriptor.landmarks) {
          setLandmarks(descriptor.landmarks);
          setSelectedLandmarkIdx(0);
        } else {
          setLandmarks([]);
          setSelectedLandmarkIdx(0);
        }

        if (!placeId) {
          let newForm = { address: '', aptSuite: '', city: '', stateProvince: '', zipPostalCode: '', country: '' };
          if (place.address_components) {
            for (const component of place.address_components) {
              const componentType = component.types[0];
              switch (componentType) {
                case 'street_number':
                  newForm.address = `${component.long_name} `;
                  break;
                case 'route':
                  newForm.address += component.short_name;
                  break;
                case 'locality':
                  newForm.city = component.long_name;
                  break;
                case 'administrative_area_level_1':
                  newForm.stateProvince = component.short_name;
                  break;
                case 'postal_code':
                  newForm.zipPostalCode = component.long_name;
                  break;
                case 'country':
                  newForm.country = component.long_name;
                  break;
              }
            }
          }
          setForm(prev => ({...prev, ...newForm}));
          if (inputRef.current) inputRef.current.value = newForm.address;
        }
      }
    } catch (e: any) {
      console.warn("Geocoding Service fell back to manual mode:", e.message);
      // Silently fail if billing isn't enabled to allow manual entry
    }
  };

  useEffect(() => {
    if (geocodingLib) {
      geocodeLocation(markerPos);
    }
  }, [geocodingLib]);

  const handleDragEnd = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const pos = e.latLng.toJSON();
      setMarkerPos(pos);
      geocodeLocation(pos);
    }
  };

  const combinedAddress = `${form.address ? form.address + '\n' : ''}${form.aptSuite ? form.aptSuite + '\n' : ''}${form.city ? form.city + ', ' : ''}${form.stateProvince} ${form.zipPostalCode}\n${form.country}\n${landmarks[selectedLandmarkIdx] ? 'Landmark: ' + landmarks[selectedLandmarkIdx].spatial_relationship + ' ' + landmarks[selectedLandmarkIdx].display_name : ''}`.trim();

  return (
    <>
      <div className="w-full sm:w-[350px] md:w-[400px] bg-card border-r border-border flex flex-col h-[50vh] sm:h-full shrink-0 z-20 shadow-xl">
         <div className="flex items-center justify-between p-4 border-b border-border shadow-sm">
            <h2 className="text-lg font-bold">Address Descriptor Demo</h2>
            <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full transition-colors flex items-center justify-center">
              <X className="w-5 h-5" />
            </button>
         </div>
         <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Address</label>
              <input ref={inputRef} type="text" className="w-full bg-secondary border border-border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all" placeholder="Start typing address..." />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Apt, Suite, etc (optional)</label>
              <input type="text" value={form.aptSuite} onChange={e => setForm({...form, aptSuite: e.target.value})} className="w-full bg-secondary border border-border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all" />
            </div>
            
            {landmarks.length > 0 && (
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Landmark</label>
                <select value={selectedLandmarkIdx} onChange={e => setSelectedLandmarkIdx(Number(e.target.value))} className="w-full bg-secondary border border-border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all">
                  {landmarks.map((lm, idx) => (
                    <option key={`opt-${idx}-${lm.place_id || 'lm'}`} value={idx}>{lm.spatial_relationship} {lm.display_name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">City</label>
              <input type="text" value={form.city} onChange={e => setForm({...form, city: e.target.value})} className="w-full bg-secondary border border-border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all" />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">State/Province</label>
                <input type="text" value={form.stateProvince} onChange={e => setForm({...form, stateProvince: e.target.value})} className="w-full bg-secondary border border-border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all" />
              </div>
              <div className="flex-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Zip/Postal code</label>
                <input type="text" value={form.zipPostalCode} onChange={e => setForm({...form, zipPostalCode: e.target.value})} className="w-full bg-secondary border border-border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all" />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Country</label>
              <input type="text" value={form.country} onChange={e => setForm({...form, country: e.target.value})} className="w-full bg-secondary border border-border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all" />
            </div>
            
            <button 
              onClick={() => onLocationSelect(`https://www.google.com/maps?q=${markerPos.lat},${markerPos.lng}`, combinedAddress)}
              className="w-full py-3 bg-blue-500 text-white font-bold rounded-xl mt-6 transition-all hover:bg-blue-600 shadow-md active:scale-[0.98] uppercase tracking-wider flex items-center justify-center gap-2"
            >
              Checkout
            </button>

            <div className="mt-6 relative flex flex-col pt-4 bg-secondary/50 rounded-xl p-4 border border-border/50">
               <div className="flex items-center gap-2 mb-2 text-muted-foreground font-bold text-xs uppercase tracking-wider">
                 <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                 Delivery Address
               </div>
               <textarea 
                  readOnly 
                  value={combinedAddress}
                  className="w-full bg-transparent border-none resize-none h-24 text-sm font-medium text-foreground focus:outline-none px-1"
               />
            </div>
         </div>
      </div>
      
      <div className="flex-1 relative h-[50vh] sm:h-full bg-zinc-100">
         <button 
           type="button"
           id="location-picker-close-map-btn"
           onClick={onClose} 
           className="absolute top-4 right-4 z-[9999] p-2.5 bg-background hover:bg-secondary text-foreground backdrop-blur-md rounded-full shadow-2xl border border-border flex items-center justify-center transition-all cursor-pointer pointer-events-auto hover:scale-105 active:scale-95"
           aria-label="Close"
           title="Close"
         >
            <X className="w-5 h-5 text-foreground stroke-[2px]" />
         </button>
         <Map
           defaultCenter={{lat: 28.43268, lng: 77.0459}}
           defaultZoom={16}
           mapId="f8b9e6163e48e501"
           internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
           style={{width: '100%', height: '100%'}}
           disableDefaultUI={true}
           gestureHandling="greedy"
         >
           <AdvancedMarker position={markerPos} draggable={true} onDragEnd={handleDragEnd}>
             <Pin background="#ea4335" glyphColor="#fff" borderColor="#c5221f" />
           </AdvancedMarker>

           {landmarks.map((lm, idx) => {
             if (!lm.location) return null;
             const isHighlighted = idx === selectedLandmarkIdx;
             return (
               <AdvancedMarker key={`mark-${idx}-${lm.place_id || 'lm'}`} position={{lat: lm.location.latitude, lng: lm.location.longitude}}>
                 <div className={`rounded-full text-white font-bold text-[11px] w-6 h-6 flex items-center justify-center relative shadow-md border border-white/20 transition-all ${isHighlighted ? 'bg-red-500 scale-125 z-10' : 'bg-[#4285f4] z-0'}`}>
                    {idx + 1}
                 </div>
               </AdvancedMarker>
             );
           })}
         </Map>
      </div>
    </>
  );
}

export function LocationPickerModal({ isOpen, onClose, onLocationSelect }: LocationPickerModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-6 md:p-8">
      <div className="w-full h-full sm:h-[90vh] sm:rounded-3xl flex flex-col sm:flex-row bg-card overflow-hidden shadow-2xl relative border-none sm:border sm:border-border">
         {!hasValidKey ? (
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',fontFamily:'sans-serif', padding: '20px', width: '100%'}}>
              <div style={{textAlign:'center',maxWidth:520}}>
                <h2 className="text-xl font-bold mb-4">Google Maps API Key Required</h2>
                <p className="mb-2"><strong>Step 1:</strong> <a className="text-primary hover:underline" href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais" target="_blank" rel="noopener">Get an API Key</a></p>
                <p className="mb-2"><strong>Step 2:</strong> Add your key as a secret in AI Studio:</p>
                <ul style={{textAlign:'left',lineHeight:'1.8'}} className="bg-secondary p-4 rounded-xl mb-4 text-sm mt-2">
                  <li>Open <strong>Settings</strong> (⚙️ gear icon, <strong>top-right corner</strong>)</li>
                  <li>Select <strong>Secrets</strong></li>
                  <li>Type <code>GOOGLE_MAPS_PLATFORM_KEY</code> as the secret name, press <strong>Enter</strong></li>
                  <li>Paste your API key as the value, press <strong>Enter</strong></li>
                </ul>
                <p className="text-muted-foreground text-sm">The app rebuilds automatically after you add the secret.</p>
                <button onClick={onClose} className="mt-6 px-6 py-2 bg-primary text-primary-foreground rounded-full font-bold">Close</button>
              </div>
            </div>
         ) : (
            <APIProvider apiKey={API_KEY} version="beta">
               <CheckoutLayout onClose={onClose} onLocationSelect={onLocationSelect} />
            </APIProvider>
         )}
      </div>
    </div>,
    document.body
  );
}

