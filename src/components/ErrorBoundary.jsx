
import React from 'react';
export default class ErrorBoundary extends React.Component{
  constructor(p){ super(p); this.state={error:null, info:null}; }
  static getDerivedStateFromError(error){ return {error}; }
  componentDidCatch(error, info){ this.setState({info}); console.error('[ErrorBoundary]', error, info); }
  render(){ if(this.state.error){ return (
    <div style={{padding:24}}>
      <h2>Ha ocurrido un error</h2>
      <pre style={{whiteSpace:'pre-wrap'}}>{String(this.state.error.stack||this.state.error)}</pre>
      <button className="btn" onClick={()=>location.reload()}>Reintentar</button>
    </div>
  ); } return this.props.children; }
}
