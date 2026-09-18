import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/layout'
import { EntryPage } from '@/pages/entry-page'
import { Home } from '@/pages/home'
import { HowItWorks } from '@/pages/how-it-works'
import { ListPage } from '@/pages/list-page'
import { docs } from '@/lib/content'
import { useBionic } from '@/lib/prefs'

// HashRouter keeps deep links working on GitHub Pages with no 404 rewrite.
export const App = () => {
  const { bionic, toggleBionic } = useBionic()

  return (
    <HashRouter>
      <Layout bionic={bionic} onToggleBionic={toggleBionic}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/docs"
            element={
              <ListPage
                title="The series"
                blurb="Seven parts, from a plain-state interview table to server-driven filters. Each ends with a graded quiz."
                entries={docs}
              />
            }
          />
          <Route path="/docs/:slug" element={<EntryPage kind="doc" bionic={bionic} />} />
          <Route path="/how-it-works" element={<HowItWorks bionic={bionic} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  )
}
