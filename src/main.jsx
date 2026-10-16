import React, {useEffect,useState} from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles.css';

class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return <main className="fatal-error"><h1>Let’s get you back in the fight.</h1><p>This view couldn’t load. Your saved plans are still in this browser.</p><button className="btn btn-primary" onClick={() => location.assign('/')}>Return to dashboard</button><details><summary>Error details</summary><pre>{String(this.state.error.message)}</pre></details></main>;
    return this.props.children;
  }
}

function DataBootstrap(){
  const [data,setData]=useState(null),[failed,setFailed]=useState(false);
  useEffect(()=>{let active=true;import('./lib/data.js').then(module=>{if(active)setData(module.siteData);}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;};},[]);
  if(!data)return <main className="bootstrap-loading"><div className="brand-mark">L<span>↯</span></div><h1>Lucifer<span>.fps</span></h1><p>{failed?'The command center couldn’t load. Please reconnect and retry.':'Preparing your command center…'}</p>{failed&&<button className="btn btn-primary" onClick={()=>location.reload()}>Retry</button>}</main>;
  return <App data={data}/>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><ErrorBoundary><BrowserRouter><DataBootstrap /></BrowserRouter></ErrorBoundary></React.StrictMode>);
