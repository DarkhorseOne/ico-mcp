import { Router } from 'express';
import { IcoService } from '../../services/ico-service';
import { SearchQuery } from '../../types/ico';

export default function icoRoutes(icoService: IcoService) {
  const router = Router();

  router.get('/search', async (req, res) => {
    try {
      const query: SearchQuery = {
        organisationName: req.query.organisationName as string,
        registrationNumber: req.query.registrationNumber as string,
        postcode: req.query.postcode as string,
        publicAuthority: req.query.publicAuthority as string,
        paymentTier: req.query.paymentTier as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0
      };

      const results = await icoService.searchRegistrations(query);
      res.json({
        success: true,
        data: results,
        count: results.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  router.get('/:registrationNumber', async (req, res) => {
    try {
      const registration = await icoService.getRegistrationByNumber(req.params.registrationNumber);
      if (!registration) {
        return res.status(404).json({
          success: false,
          error: 'Registration not found'
        });
      }

      res.json({
        success: true,
        data: registration
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  router.get('/organisation/:name', async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const results = await icoService.getRegistrationsByOrganisation(req.params.name, limit);
      
      res.json({
        success: true,
        data: results,
        count: results.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  router.get('/postcode/:postcode', async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const results = await icoService.getRegistrationsByPostcode(req.params.postcode, limit);
      
      res.json({
        success: true,
        data: results,
        count: results.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  router.get('/meta/version', async (req, res) => {
    try {
      const currentVersion = await icoService.getCurrentDataVersion();
      const stats = await icoService.getDataStats();
      
      res.json({
        success: true,
        data: {
          currentVersion,
          recordCount: stats.recordCount
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  router.get('/meta/versions', async (req, res) => {
    try {
      const versions = await icoService.getAllDataVersions();
      
      res.json({
        success: true,
        data: versions
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}