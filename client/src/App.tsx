import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import PeopleList from './pages/PeopleList';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="people" element={<PeopleList />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
