"""
XplorePrint - Bambu Lab MQTT Client
FRC Team 11019 Xplore

Communicates with Bambu Lab 3D printers via MQTT protocol in LAN mode.
Based on the community-documented Bambu Lab MQTT API.
"""

import json
import ssl
import time
import threading
import logging
from typing import Optional, Callable

import paho.mqtt.client as mqtt

from .models import Printer, PrinterStatus, PrinterModel, AMSStatus

logger = logging.getLogger(__name__)


class BambuMQTTClient:
    """MQTT client for communicating with Bambu Lab printers."""

    REPORT_TOPIC = "device/{serial}/report"

    def __init__(self, printer: Printer):
        self.printer = printer
        self.client = mqtt.Client(
            client_id=f"xploreprint_{printer.id}",
            protocol=mqtt.MQTTv311
        )
        self.client.username_pw_set("bblp", password=printer.access_code)
        self.client.tls_set(cert_reqs=ssl.CERT_NONE)
        self.client.tls_insecure_set(True)
        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message
        self.client.on_disconnect = self._on_disconnect
        self._connected = False
        self._callbacks: list[Callable] = []
        self._thread: Optional[threading.Thread] = None

    def register_callback(self, callback: Callable):
        self._callbacks.append(callback)

    def connect(self):
        try:
            self.client.connect(
                self.printer.ip_address,
                port=8883,
                keepalive=60
            )
            self._thread = threading.Thread(
                target=self._run_loop,
                daemon=True
            )
            self._thread.start()
            logger.info(
                f"Connecting to printer {self.printer.name} "
                f"at {self.printer.ip_address}:8883"
            )
        except Exception as e:
            logger.error(f"Failed to connect to {self.printer.name}: {e}")
            self.printer.status = PrinterStatus.OFFLINE

    def _run_loop(self):
        try:
            self.client.loop_forever()
        except Exception as e:
            logger.error(f"MQTT loop error for {self.printer.name}: {e}")

    def disconnect(self):
        self.client.disconnect()
        self._connected = False
        self.printer.status = PrinterStatus.OFFLINE

    def _on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            self._connected = True
            self.printer.status = PrinterStatus.ONLINE
            report_topic = self.REPORT_TOPIC.format(
                serial=self.printer.serial_number
            )
            client.subscribe(report_topic)
            logger.info(f"Connected to {self.printer.name}, subscribed to {report_topic}")
        else:
            logger.error(f"Connection failed for {self.printer.name}, rc={rc}")
            self.printer.status = PrinterStatus.OFFLINE

    def _on_disconnect(self, client, userdata, rc):
        self._connected = False
        self.printer.status = PrinterStatus.OFFLINE
        logger.warning(f"Disconnected from {self.printer.name}")

    def _on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
            self._parse_report(payload)
            for cb in self._callbacks:
                cb(self.printer)
        except json.JSONDecodeError:
            logger.warning(f"Invalid JSON from {self.printer.name}")
        except Exception as e:
            logger.error(f"Error processing message from {self.printer.name}: {e}")

    def _parse_report(self, data: dict):
        print_data = data.get("print", {})
        self.printer.print_progress = print_data.get("mc_percent", 0)
        self.printer.layer_num = print_data.get("mc_remaining_layer", 0)
        self.printer.total_layers = print_data.get("total_layer_num", 0)
        self.printer.current_file = print_data.get("gcode_file", "")
        self.printer.print_time_remaining = print_data.get("mc_remaining_time", 0)

        gcode_state = print_data.get("gcode_state", "").lower()
        if gcode_state in ("running", "prepare"):
            self.printer.status = PrinterStatus.PRINTING
        elif gcode_state == "paused":
            self.printer.status = PrinterStatus.PAUSED
        elif gcode_state == "finish":
            self.printer.status = PrinterStatus.FINISHING
        elif gcode_state == "failed":
            self.printer.status = PrinterStatus.ERROR
            self.printer.error_message = print_data.get("fail_reason", "Unknown error")
        else:
            self.printer.status = PrinterStatus.IDLE

        self.printer.nozzle_temp = round(print_data.get("nozzle_temper", 0), 1)
        self.printer.target_nozzle_temp = round(print_data.get("nozzle_target_temper", 0), 1)
        self.printer.bed_temp = round(print_data.get("bed_temper", 0), 1)
        self.printer.target_bed_temp = round(print_data.get("bed_target_temper", 0), 1)
        self.printer.chamber_temp = round(print_data.get("chamber_temper", 0), 1)

        self._parse_ams(data)

    def _parse_ams(self, data: dict):
        ams_data = data.get("ams", {})
        ams_list = ams_data.get("ams", [])
        if not ams_list:
            return

        self.printer.ams_units = []
        for ams_unit in ams_list:
            trays = ams_unit.get("tray", [])
            for tray in trays:
                self.printer.ams_units.append(AMSStatus(
                    tray_id=tray.get("id", 0),
                    color="#" + tray.get("tray_color", "CCCCCC"),
                    material=tray.get("tray_type", "Unknown"),
                    temperature=tray.get("tray_drying_temp", 0),
                    remaining=tray.get("remain", 0),
                ))

    def send_command(self, command: dict):
        if not self._connected:
            logger.warning(f"Cannot send command to {self.printer.name}: not connected")
            return
        topic = f"device/{self.printer.serial_number}/request"
        self.client.publish(topic, json.dumps(command))

    def pause_print(self):
        self.send_command({
            "print": {
                "command": "pause",
                "sequence_id": str(int(time.time() * 1000))
            }
        })

    def resume_print(self):
        self.send_command({
            "print": {
                "command": "resume",
                "sequence_id": str(int(time.time() * 1000))
            }
        })

    def stop_print(self):
        self.send_command({
            "print": {
                "command": "stop",
                "sequence_id": str(int(time.time() * 1000))
            }
        })

    def set_led(self, mode: str = "on"):
        self.send_command({
            "system": {
                "sequence_id": str(int(time.time() * 1000)),
                "command": "ledctrl",
                "led_node": "chamber_light",
                "led_mode": mode,
            }
        })

    def set_nozzle_temp(self, temp: float):
        self.send_command({
            "print": {
                "command": "gcode_line",
                "param": f"M104 S{temp}",
                "sequence_id": str(int(time.time() * 1000))
            }
        })

    def set_bed_temp(self, temp: float):
        self.send_command({
            "print": {
                "command": "gcode_line",
                "param": f"M140 S{temp}",
                "sequence_id": str(int(time.time() * 1000))
            }
        })

    @property
    def is_connected(self) -> bool:
        return self._connected