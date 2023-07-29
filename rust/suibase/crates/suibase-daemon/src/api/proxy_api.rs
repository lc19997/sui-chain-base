use core::fmt;
use std::fmt::Display;

use axum::async_trait;

use jsonrpsee::core::RpcResult;

use crate::admin_controller::AdminControllerTx;
use crate::shared_types::{Globals, ServerStats, TargetServer};

use super::ProxyApiServer;
use super::{LinkStats, LinksResponse, LinksSummary, RpcInputError};

pub struct ProxyApiImpl {
    pub globals: Globals,
    pub admctrl_tx: AdminControllerTx,
}

impl ProxyApiImpl {
    pub fn new(globals: Globals, admctrl_tx: AdminControllerTx) -> Self {
        Self {
            globals,
            admctrl_tx,
        }
    }

    fn fmt_f64_api(input: f64) -> String {
        // This function is used to format f64 metrics for the API.
        // Use empty string for NaN and infinite values.
        if input.is_finite() {
            format!("{:.2}", input)
        } else {
            "".to_string()
        }
    }

    fn fmt_str_ms(input: &str) -> String {
        // Transform input assuming it is a representing milliseconds
        // to be displayed within a 7 characters wide field.
        //
        // Output goes from "   0.00" to "9999.99".
        //
        // When input is >=9999.99, the output is ">10secs"
        // When input is <0.01, the output is   "  <0.01"
        // Empty, negative or bad input becomes  "      -"
        //
        let value = input.parse::<f64>().unwrap_or(-1.0);
        Self::fmt_f64_ms(value)
    }

    fn fmt_f64_ms(input: f64) -> String {
        // See fmt_str_ms for more info.
        if input.is_sign_negative() || !input.is_normal() {
            "      -".to_string()
        } else if input >= 9999.99f64 {
            ">10secs".to_string()
        } else if input < 0.01f64 {
            "  <0.01".to_string()
        } else {
            format!("{:7.2}", input)
        }
    }

    fn fmt_str_pct(input: &str) -> String {
        // Convert the input representing a positive percentage for display
        // within a field of fixed width of 5 characters.
        //
        // Expected input range is "0" or "0.0" to "100.0"
        //
        // Empty or invalid input is formated as "    -"
        //
        // Any value above "100" is ignored.
        // Any non-numeric value is ignored.
        // Only one decimal is displayed (rounding applies).
        //
        // Examples:
        //      "0" is interpreted as x == 0 and formated as      "  0.0"
        //    "0.0" is interpreted as 0 < x < 0.1 and formated as " <0.1"
        //    "100" is interpreted as x == 100 and formated as    "100.0"
        // "105.28" is interpreted as x == 100 and formated as    "100.0"
        //   "0.19" is rounded to 0.2 and formated as             "  0.2"
        let value = input
            .chars()
            .filter(|c| c.is_ascii_digit() || *c == '.')
            .collect::<String>()
            .parse::<f64>()
            .unwrap_or(-1.0);

        Self::fmt_f64_pct(value)
    }

    fn fmt_f64_pct(input: f64) -> String {
        // See fmt_str_pct for more info.
        if input.is_sign_negative() || input.is_infinite() || input.is_nan() {
            return "    -".to_string();
        }

        if input == 0.0 {
            "  0.0".to_string()
        } else if input < 0.1 {
            " <0.1".to_string()
        } else if input >= 100.001 {
            "100.0".to_string()
        } else {
            format!("{:5.1}", input)
        }
    }

    fn fmt_str_score(input: &str) -> String {
        // Similar to fmt_str_pct, except:
        //   - 0.0 is shown as empty field (spaces).
        //   - accept negative values
        //   - have a +/- prefix.
        //   - Any invalid parsing will show as empty field.
        //
        // Always 6 characters wide.
        let value = input.parse::<f64>().unwrap_or(0.0);
        Self::fmt_f64_score(value)
    }

    fn fmt_f64_score(input: f64) -> String {
        // See fmt_str_score for more info.
        if input.is_infinite() || input.is_nan() {
            return "    -".to_string();
        }

        if input == 0.0 {
            "      ".to_string()
        } else if input.is_sign_positive() {
            if input < 0.1 {
                "  <0.1".to_string()
            } else if input >= 100.001 {
                "+100.0".to_string()
            } else {
                format!("{:+6.1}", input)
            }
        } else if input > -0.1 {
            "  -0.1".to_string()
        } else if input <= -100.0 {
            "-100.0".to_string()
        } else {
            format!("{:+6.1}", input)
        }
    }

    fn fmt_u64(input: u64) -> String {
        // Fix field width of 9 characters.
        //
        // if input >99999999 then return ">99999999"
        // if input is zero then return   "        0"
        // if u64:MAX then return         "        -"
        if input > 99999999 {
            ">99999999".to_string()
        } else if input == 0 {
            "        0".to_string()
        } else if input == u64::MAX {
            "        -".to_string()
        } else {
            format!("{:9}", input)
        }
    }

    fn fmt_u32(input: u32) -> String {
        // Same logic as fmt_u64.
        if input == u32::MAX {
            Self::fmt_u64(u64::MAX)
        } else {
            Self::fmt_u64(input as u64)
        }
    }
}

#[async_trait]
impl ProxyApiServer for ProxyApiImpl {
    async fn get_links(
        &self,
        workdir: String,
        summary: Option<bool>,
        links: Option<bool>,
        data: Option<bool>,
        display: Option<bool>,
        debug: Option<bool>,
    ) -> RpcResult<LinksResponse> {
        let mut resp = LinksResponse::new();

        // "Unwrap" all the options to booleans.
        //
        // Summary/links is the enabling of group of metrics.
        //
        // data/display/debug allow variations of how the output
        // is produced (and they may be combined).
        //

        // summary/links default to true when not specified.
        //
        // data/display/debug default to false when not specified
        // with the exception of data defaulting to true when
        // the other (display and debug) are false.
        //
        let summary = summary.unwrap_or(true);
        let links = links.unwrap_or(true);
        let debug = debug.unwrap_or(false);
        let display = display.unwrap_or(debug);
        let data = data.unwrap_or(!(debug || display));

        let mut debug_out = String::new();

        // Variables initialized during the read lock.
        let mut target_servers_stats: Option<Vec<ServerStats>> = None;
        let mut all_servers_stats: Option<ServerStats> = None;
        let mut input_port_found = false;
        {
            // Get read lock access to the globals and just quickly copy what is needed.
            // All parsing and processing is done outside the lock.
            let globals_read_guard = self.globals.read().await;
            let globals = &*globals_read_guard;

            if let Some(input_port) = globals.find_input_port_by_name(&workdir) {
                input_port_found = true;
                all_servers_stats = Some(input_port.all_servers_stats.clone());

                let target_servers = &input_port.target_servers;

                target_servers_stats = Some(
                    target_servers
                        .iter()
                        .map(|(_, target_server)| target_server.stats.clone())
                        .collect(),
                );
            }

            // If debug, then extensively add more info to the output.
            if debug {
                debug_out.push_str(&format!("{:?}", globals));
            }
        } // Release the read lock.

        // We got all the needed data, now most of the response
        // building is handled outside the mutex.

        // Map the target_servers_stats into the API LinkStats.
        let mut healthy_server_count = 0;
        let mut link_stats: Vec<LinkStats> = Vec::new();
        if let Some(target_servers_stats) = target_servers_stats {
            let mut total_request: u64 = 0;
            let mut link_n_request: Vec<u64> = Vec::with_capacity(target_servers_stats.len());
            // Prepare LinkStats, which is the "metrics" portion f the API.
            //
            // The "display/debug" portion is built from the "metrics" portion.
            //
            // That feel a bit innefficient (a few extra string conversion), but here the
            // intention is to give more opportunity to catch bugs by starting to use (earlier
            // than typical) the least visible (but crucial) metrics portion.
            for (_, server_stats) in target_servers_stats.iter().enumerate() {
                let mut link_stat = LinkStats::new(server_stats.alias());

                let mut n_request = 0u64;
                let mut n_success = 0u64;
                server_stats.get_accum_stats(&mut n_request, &mut n_success);
                total_request += n_request;
                if n_request != 0 {
                    let success_pct = (n_success as f64 * 100.0f64) / (n_request as f64);
                    link_stat.success_pct = Self::fmt_f64_api(success_pct);
                };

                let health_score = server_stats.health_score();
                if health_score.is_normal() && health_score.is_sign_positive() {
                    healthy_server_count += 1;
                }
                link_stat.health_pct = Self::fmt_f64_api(health_score);

                link_stat.resp_time = Self::fmt_f64_api(server_stats.avg_latency_ms());

                // Push always together for 1:1 index matching.
                link_stats.push(link_stat);
                link_n_request.push(n_request);
            }

            // Calculate the load_pct by iterating each link_stats.
            if total_request != 0 {
                for (i, link_stat) in link_stats.iter_mut().enumerate() {
                    let load_pct = (link_n_request[i] as f64 * 100.0f64) / (total_request as f64);
                    link_stat.load_pct = Self::fmt_f64_api(load_pct);
                }
            }
        }
        let link_stats = link_stats; // Make immutable.

        // Map the all_servers_stats into the API LinksSummary.
        let mut summary_stats = LinksSummary::new();

        if let Some(all_servers_stats) = all_servers_stats {
            summary_stats.success_on_first_attempt = all_servers_stats.success_on_first_attempt();
            summary_stats.success_on_retry = all_servers_stats.success_on_retry();
            all_servers_stats.get_classified_failure(
                &mut summary_stats.fail_network_down,
                &mut summary_stats.fail_bad_request,
                &mut summary_stats.fail_others,
            );
        }

        if !input_port_found {
            // TODO Return an error of workdir not found.
            return Err(RpcInputError::InvalidParams("workdir".to_string(), workdir).into());
        }

        // Identify the status with the following rule:
        //   DISABLED: Disabled by user (either disabled in config or not started)
        //   NO CONFIG: No servers specified in the config.
        //   OK: More than 50% of the servers are healthy.
        //   DEGRADED: Less than 50% of the servers are healthy.
        //   DOWN: Not a single healthy server found.
        let server_count = link_stats.len();
        resp.status = if !input_port_found {
            "DISABLED".to_string()
        } else if server_count == 0 {
            "NO CONFIG".to_string()
        } else if healthy_server_count == 0 {
            "DOWN".to_string()
        } else if (healthy_server_count * 100 / server_count) > 50 {
            "OK".to_string()
        } else {
            "DEGRADED".to_string()
        };

        let mut display_out = String::new();

        if display {
            // User requested human-friendly display.
            if summary {
                display_out.push_str(&format!(
                    "Multi-Link RPC status: {}\n\n\
                    Cummulative Request Stats\n\
  -------------------------\n\
  Success first attempt {:>9}   ({:>5} %)\n\
  Success after retry   {:>9}   ({:>5} %)\n\
  Failure network down  {:>9}   ({:>5} %)\n\
  Failure bad request   {:>9}   ({:>5} %)\n\
  Failure others        {:>9}   ({:>5} %)\n\n",
                    resp.status,
                    summary_stats.success_on_first_attempt,
                    Self::fmt_f64_pct(0.0f64),
                    summary_stats.success_on_retry,
                    Self::fmt_f64_pct(0.0f64),
                    summary_stats.fail_network_down,
                    Self::fmt_f64_pct(0.0f64),
                    summary_stats.fail_bad_request,
                    Self::fmt_f64_pct(0.0f64),
                    summary_stats.fail_others,
                    Self::fmt_f64_pct(0.0f64),
                ));
            }

            if links {
                display_out.push_str(
                    "alias                Health %    Load %    RespT ms   Success %\n---------------------------------------------------------------\n"
                );
                for link_stat in link_stats.iter() {
                    display_out.push_str(&format!(
                        "{:<20}   {:9}  {:9} {:9}     {:9}\n",
                        link_stat.alias,
                        Self::fmt_str_score(&link_stat.health_pct),
                        Self::fmt_str_pct(&link_stat.load_pct),
                        Self::fmt_str_ms(&link_stat.resp_time),
                        Self::fmt_str_pct(&link_stat.success_pct),
                    ));
                }
            }
            // Total Request Counts
            //   Success first attempt      10291212   100 %
            //   Success after retry                     0
            //   Failure after retry                     0
            //   Failure on network down                 0
            //   Bad Request                             0
            //
            // alias    Health %   Load  %   RespT ms    Retry %
            //            +100.1      98.1     102.12   >0.001
            //               0.0       2.2    >1 secs        -

            resp.display = Some(display_out);
        }

        if debug {
            resp.debug = Some(debug_out);
        }

        if data {
            // User requested the raw stats.
            if summary {
                resp.summary = Some(summary_stats);
            }
            if links {
                resp.links = Some(link_stats);
            }
        }

        Ok(resp)
    }
}